"""Build and audit the pinned native OpenGrep scanner dependency closure."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import logging
import os
import platform
import posixpath
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
LOGGER = logging.getLogger(__name__)
HOSTED_SANDBOX = Path("/usr/libexec/rezwan-native-sandbox/bin/bwrap")
HOSTED_POLICY = Path("/etc/apparmor.d/rezwan-native-bwrap")


def verify_blob(blob: bytes, expected: str) -> None:
    """Require an explicit SHA-256 before downloaded bytes can be used."""
    if re.fullmatch(r"[0-9a-f]{64}", expected) is None:
        raise ValueError("Source lock must contain a complete SHA-256")
    if hashlib.sha256(blob).hexdigest() != expected:
        raise RuntimeError("Source digest mismatch; refusing to use downloaded bytes")


def extract_source(blob: bytes, destination: Path) -> None:
    """Extract a single source root while rejecting paths or links outside it."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as archive:
        members = archive.getmembers()
        roots: set[str] = set()
        for member in members:
            path = PurePosixPath(member.name)
            if path.is_absolute() or ".." in path.parts or not path.parts:
                raise ValueError("Source archive contains a nonlocal member path")
            roots.add(path.parts[0])
            if member.issym() or member.islnk():
                target = PurePosixPath(member.linkname)
                parent = path.parent if member.issym() else PurePosixPath()
                normalized = PurePosixPath(posixpath.normpath(str(parent / target)))
                if (
                    target.is_absolute()
                    or not normalized.parts
                    or normalized.parts[0] != path.parts[0]
                ):
                    raise ValueError("Source archive contains an escaping link")
            elif not member.isfile() and not member.isdir():
                raise ValueError("Source archive contains an unsupported member type")
        if len(roots) != 1:
            raise ValueError("Source archive must contain exactly one root directory")
        with tempfile.TemporaryDirectory(dir=destination.parent) as temporary:
            archive.extractall(temporary, filter="data")
            source = Path(temporary) / roots.pop()
            if not source.is_dir() or source.is_symlink():
                raise ValueError("Source archive root must be a regular directory")
            if destination.is_symlink():
                raise ValueError("Source destination must not be a symbolic link")
            if destination.exists():
                destination.rmdir()
            source.rename(destination)


def inspect_osv(report: object, count: int) -> list[dict[str, Any]]:
    """Reject partial audits and retain every returned vulnerability."""
    if count <= 0 or not isinstance(report, dict):
        raise ValueError("Native audit requires a nonempty complete batch")
    results = report.get("results")
    if not isinstance(results, list) or len(results) != count:
        raise ValueError("Native audit returned missing or partial results")
    findings: list[dict[str, Any]] = []
    for index, result in enumerate(results):
        if not isinstance(result, dict) or result.get("next_page_token"):
            raise ValueError("Native audit returned malformed or unfinished results")
        vulnerabilities = result.get("vulns", [])
        if not isinstance(vulnerabilities, list):
            raise ValueError("Native audit vulnerabilities must be a list")
        for vulnerability in vulnerabilities:
            if (
                not isinstance(vulnerability, dict)
                or not isinstance(vulnerability.get("id"), str)
                or not vulnerability["id"]
            ):
                raise ValueError(
                    "Native audit returned a vulnerability without identity"
                )
            findings.append({"query_index": index, **vulnerability})
    return findings


def validate_inventory(expected: dict[str, str], actual: dict[str, str]) -> None:
    """Prevent a changed or incomplete switch from using an earlier clean audit."""
    if not expected or actual != expected:
        raise ValueError("Installed native dependencies differ from the frozen lock")


def verified_sandbox_helper(
    work: Path,
    manifest: dict[str, Any],
    search_path: str,
    *,
    installed: bool = False,
) -> Path:
    """Require the locked helper instead of falling back to an unpinned host tool."""
    assets = [item for item in manifest["assets"] if item["name"] == "bubblewrap"]
    if len(assets) != 1:
        raise ValueError("Native source lock must identify exactly one bubblewrap package")
    helper = HOSTED_SANDBOX if installed else work / "sysroot/usr/bin/bwrap"
    if installed:
        require_root_owned_path(helper)
        if stat.S_IMODE(helper.stat().st_mode) != 0o555:
            raise RuntimeError("The installed sandbox helper has unexpected permissions")
    if helper.is_symlink() or not helper.is_file() or not os.access(helper, os.X_OK):
        raise RuntimeError("The verified bubblewrap helper is missing or not executable")
    verify_blob(helper.read_bytes(), assets[0]["executable_sha256"])
    if shutil.which("bwrap", path=search_path) != str(helper):
        raise RuntimeError("The opam sandbox would use an unverified bubblewrap helper")
    return helper


def require_root_owned_path(path: Path) -> None:
    """Reject links and any path component writable by a non-root identity."""
    for node in (path, *path.parents):
        metadata = node.lstat()
        if (
            stat.S_ISLNK(metadata.st_mode)
            or metadata.st_uid != 0
            or metadata.st_gid != 0
            or metadata.st_mode & 0o6022
        ):
            raise RuntimeError(f"Sandbox system path is not protected: {node}")


def sandbox_profile(blob: bytes, expected: str) -> str:
    """Narrow Ubuntu's locked policy to one helper and preserve child denial."""
    verify_blob(blob, expected)
    value = blob.decode()
    replacements = {
        "profile bwrap /usr/bin/bwrap flags=": (
            f"profile rezwan-native-bwrap {HOSTED_SANDBOX} flags="
        ),
        "profile unpriv_bwrap flags=": "profile rezwan-native-unpriv-bwrap flags=",
        "  allow capability,": (
            "  allow capability sys_admin sys_chroot net_admin "
            "setuid setgid sys_ptrace,"
        ),
        "  allow px /** -> bwrap//&unpriv_bwrap,": (
            "  allow px /** -> rezwan-native-bwrap//&rezwan-native-unpriv-bwrap,"
        ),
        "  allow pix /** -> &unpriv_bwrap,": (
            "  allow pix /** -> &rezwan-native-unpriv-bwrap,"
        ),
        "  include if exists <local/bwrap-userns-restrict>": (
            "  # Dedicated helper policy has no site-specific capability overrides."
        ),
        "  include if exists <local/unpriv_bwrap>": (
            "  # Child capability denial cannot be overridden through local includes."
        ),
    }
    if value.count("  audit deny capability,") != 1:
        raise ValueError("Ubuntu sandbox policy is missing its child capability denial")
    for original, replacement in replacements.items():
        if value.count(original) != 1:
            raise ValueError("Ubuntu sandbox policy has an unexpected structure")
        value = value.replace(original, replacement)
    return value


def require_sandbox_profile(value: str) -> None:
    """Require the actual child process to use both enforcing policy layers."""
    expected = "rezwan-native-bwrap//&rezwan-native-unpriv-bwrap (enforce)"
    lines = value.splitlines()
    if not lines or lines[0] != expected:
        raise RuntimeError("The sandbox child is missing its enforcing capability policy")
    fields = dict(line.split(":", 1) for line in lines[1:] if ":" in line)
    for name in ("CapEff", "CapPrm"):
        if fields.get(name, "").strip() != "0000000000000000":
            raise RuntimeError("The sandbox child retained capabilities")
    if fields.get("NoNewPrivs", "").strip() != "1":
        raise RuntimeError("The sandbox child can acquire new privileges")


def require_sandbox_hook(value: str, phase: str) -> None:
    """Reject an init result that disables or changes the pinned opam sandbox."""
    if phase not in {"build", "install", "remove"}:
        raise ValueError("Unknown opam sandbox phase")
    expected = f'["%{{hooks}}%/sandbox.sh" "{phase}"] {{os = "linux" | os = "macos"}}'
    if " ".join(value.split()) != expected:
        raise RuntimeError(f"The opam {phase} sandbox hook is absent or changed")


def inspect_audit_report(
    report: object, queries: list[dict[str, Any]]
) -> dict[str, int]:
    """Validate a persisted audit independently of the scanner process exit code."""
    if not isinstance(report, dict) or report.get("queries") != queries:
        raise ValueError("Native audit omitted or changed a locked component")
    if report.get("status") not in {"passed", "failed"}:
        raise ValueError("Native audit has no terminal execution status")
    findings = inspect_osv({"results": report.get("results")}, len(queries))
    if report["status"] != "passed" and not findings:
        raise ValueError("Native audit failed without a completed vulnerability result")
    return {
        "audited_components": len(queries),
        "findings": len(findings),
        "blocking_findings": len(findings),
    }


def verify_cache(root: Path, identity: str) -> bool:
    """Accept only a complete cache built from these inputs with unchanged bytes."""
    receipt_path = root / "receipt.json"
    if not receipt_path.exists():
        return False
    receipt = json.loads(receipt_path.read_text())
    if not isinstance(receipt, dict):
        raise ValueError("Native cache receipt must be an object")
    if receipt.get("input_sha256") != identity:
        return False
    files = receipt.get("files")
    if not isinstance(files, dict) or not files:
        raise ValueError("Native cache receipt must identify all build outputs")
    actual_files = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and path != receipt_path
    }
    if actual_files != set(files):
        raise RuntimeError("Native cache contains missing or unexpected build outputs")
    for name, digest in files.items():
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError("Native cache output path must be relative")
        output = root / path
        if output.is_symlink() or not output.is_file():
            raise RuntimeError("Native cache outputs must be regular files")
        verify_blob(output.read_bytes(), digest)
    return True


def load_manifest() -> dict[str, Any]:
    """Bind the independently audited inventory to the complete opam export."""
    manifest = json.loads((HERE / "native-scanner.json").read_text())
    if not isinstance(manifest, dict) or manifest.get("schema") != 1:
        raise ValueError("Unsupported native scanner manifest")
    frozen = (HERE / "native-switch.export").read_bytes()
    verify_blob(frozen, manifest["native_switch_sha256"])
    installed = re.search(r"^installed:\s*\[(.*?)^\]", frozen.decode(), re.M | re.S)
    if installed is None:
        raise ValueError("Native switch export has no installed package inventory")
    inventory: dict[str, str] = {}
    for package in re.findall(r'"([^"\n]+)"', installed[1]):
        name, version = package.split(".", 1)
        if name in inventory:
            raise ValueError("Native switch export contains duplicate packages")
        inventory[name] = version
    validate_inventory(manifest["installed_packages"], inventory)
    return manifest


def audit_queries(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    """Include every opam package, downloaded component and bundled dependency."""
    queries = [
        {"package": {"ecosystem": "opam", "name": name}, "version": version}
        for name, version in sorted(manifest["installed_packages"].items())
    ]
    queries.extend(asset["audit"] for asset in manifest["assets"])
    queries.extend(item["query"] for item in manifest["additional_audited_components"])
    unique: dict[str, dict[str, Any]] = {}
    for query in queries:
        if not isinstance(query, dict):
            raise ValueError("Every native component needs an explicit audit query")
        if set(query) == {"commit"}:
            if re.fullmatch(r"[0-9a-f]{40}", query["commit"]) is None:
                raise ValueError("Native source audits require complete Git commits")
        elif set(query) == {"package", "version"}:
            package = query["package"]
            if (
                not isinstance(package, dict)
                or set(package) != {"name", "ecosystem"}
                or not all(
                    isinstance(value, str) and value for value in package.values()
                )
                or not isinstance(query["version"], str)
                or not query["version"]
            ):
                raise ValueError("Native package audits require exact identities")
        else:
            raise ValueError("Native component has an unsupported audit query")
        unique[json.dumps(query, sort_keys=True)] = query
    if not unique:
        raise ValueError("Native scanner audit cannot have an empty scope")
    return list(unique.values())


def audit(manifest: dict[str, Any], output: Path) -> dict[str, Any]:
    """Fail on any advisory or incomplete response, retaining the complete batch."""
    queries = audit_queries(manifest)
    response = https_bytes(
        "https://api.osv.dev/v1/querybatch", json.dumps({"queries": queries}).encode()
    )
    report = json.loads(response)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {"status": "failed", "queries": queries, "response": report}, indent=2
        )
        + "\n"
    )
    findings = inspect_osv(report, len(queries))
    receipt = {
        "status": "failed" if findings else "passed",
        "scanner": manifest["scanner"],
        "queries": queries,
        "results": report["results"],
        "findings": findings,
        "audited_components": len(queries),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(receipt, indent=2) + "\n")
    if findings:
        raise RuntimeError(
            f"Native scanner dependencies have {len(findings)} advisories"
        )
    return receipt


def https_bytes(address: str, payload: bytes | None = None) -> bytes:
    """Require HTTPS at every redirect and bound the system curl transfer."""
    parsed = urlsplit(address)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError("Native scanner requests require uncredentialed HTTPS")
    curl = shutil.which("curl")
    if curl is None:
        raise RuntimeError("The native source bootstrap requires the runner's curl")
    command = [
        curl,
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        "--max-redirs",
        "10",
        "--max-time",
        "120",
        "--retry",
        "3",
        "--retry-delay",
        "2",
        "--retry-max-time",
        "120",
    ]
    if payload is not None:
        command.extend(
            ["--header", "Content-Type: application/json", "--data-binary", "@-"]
        )
    command.extend(["--url", address])
    result = subprocess.run(  # noqa: S603 -- guarded HTTPS argv; no shell
        command, input=payload, capture_output=True, check=True, timeout=270
    )
    return result.stdout


def download(asset: dict[str, Any], directory: Path) -> Path:
    """Verify both restored download bytes and every new HTTPS source archive."""
    digest = asset["sha256"]
    if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
        raise ValueError("Native source digest must be a complete SHA-256")
    target = directory / digest
    if target.exists():
        verify_blob(target.read_bytes(), asset["sha256"])
        return target
    content = https_bytes(str(asset["url"]))
    verify_blob(content, digest)
    target.write_bytes(content)
    return target


def input_identity() -> str:
    """Bind cached outputs to scanner sources, locks and the complete build code."""
    names = (
        "native_scanner.py",
        "bootstrap.py",
        "native-scanner.json",
        "native-switch.export",
        "requirements.txt",
        "requirements-bootstrap.txt",
        "requirements-build.txt",
    )
    digest = hashlib.sha256()
    for name in names:
        digest.update(name.encode() + b"\0" + (HERE / name).read_bytes() + b"\0")
    return digest.hexdigest()


class Builder:
    """Build upstream targets from locked inputs without changing their constraints."""

    def __init__(
        self, destination: Path, output: Path, manifest: dict[str, Any]
    ) -> None:
        """Keep generated build files and evidence beneath explicit destinations."""
        self.destination = destination.resolve()
        self.output = output.resolve()
        self.manifest = manifest
        self.work = self.destination / "native-build"
        self.source = self.work / "source"
        self.native = self.destination / "native"
        self.identity = input_identity()
        self.environment = dict(os.environ)
        self.timings: list[dict[str, Any]] = []

    def command(
        self,
        name: str,
        arguments: list[str],
        *,
        cwd: Path | None = None,
        timeout: int = 900,
    ) -> str:
        """Retain each real build command, output, duration and failure status."""
        started = time.monotonic()
        receipt: dict[str, Any] = {
            "name": name,
            "command": arguments,
            "status": "running",
        }
        self.timings.append(receipt)
        self.output.mkdir(parents=True, exist_ok=True)
        stdout = self.output / f"{name}.stdout.log"
        stderr = self.output / f"{name}.stderr.log"
        try:
            with stdout.open("w") as out, stderr.open("w") as err:
                # Build commands are fixed here; source inputs are hash verified.
                result = subprocess.run(  # noqa: S603 -- no shell or external command text
                    arguments,
                    cwd=cwd or self.work,
                    env=self.environment,
                    stdout=out,
                    stderr=err,
                    timeout=timeout,
                    check=False,
                )
            receipt.update(
                exit_code=result.returncode,
                status="passed" if result.returncode == 0 else "failed",
            )
            if result.returncode:
                raise RuntimeError(f"Native scanner stage {name} failed; see {stderr}")
            return stdout.read_text()
        except (OSError, subprocess.SubprocessError) as error:
            receipt.update(status="failed", error=f"{type(error).__name__}: {error}")
            raise
        finally:
            receipt["duration_seconds"] = time.monotonic() - started
            (self.output / "native-build-stages.json").write_text(
                json.dumps(self.timings, indent=2) + "\n"
            )

    def prepare(self) -> None:
        """Install verified source archives and C libraries in a private prefix."""
        if self.work.exists():
            raise RuntimeError(
                "Native build directory already exists; use a fresh destination"
            )
        self.work.mkdir(parents=True)
        downloads = self.work / "downloads"
        downloads.mkdir()
        started = time.monotonic()
        assets = self.manifest["assets"]
        with ThreadPoolExecutor(max_workers=8) as workers:
            paths = list(workers.map(lambda asset: download(asset, downloads), assets))
        for asset, path in zip(assets, paths, strict=True):
            relative = PurePosixPath(asset["destination"])
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError("Native source destination must be relative")
            destination = self.work / relative
            if asset["kind"] == "archive":
                extract_source(path.read_bytes(), destination)
            elif asset["kind"] == "executable":
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, destination)
                destination.chmod(0o755)
            elif asset["kind"] == "deb":
                destination.mkdir(parents=True, exist_ok=True)
                self.command(
                    "extract-" + asset["name"],
                    ["dpkg-deb", "-x", str(path), str(destination)],
                )
            else:
                raise ValueError("Native source asset has an unknown distribution type")
        self.timings.append(
            {
                "name": "source-inputs",
                "status": "passed",
                "duration_seconds": time.monotonic() - started,
            }
        )
        tree = self.source / "libs/ocaml-tree-sitter-core/tree-sitter"
        sysroot = self.work / "sysroot/usr"
        prefix = self.work / "prefix"
        self.environment.update(
            PATH=f"{self.work}/tools:{sysroot}/bin:" + self.environment["PATH"],
            OPAMROOT=str(self.work / "opam-root"),
            OPAMSWITCH="scanner",
            OPAMROOTISOK="1",
            SOURCE_DATE_EPOCH=str(self.manifest["scanner"]["source_date_epoch"]),
            LD_LIBRARY_PATH=f"{tree}/lib:{sysroot}/lib/x86_64-linux-gnu",
            C_INCLUDE_PATH=f"{sysroot}/include:{sysroot}/include/x86_64-linux-gnu:{prefix}/include",
            LIBRARY_PATH=f"{prefix}/lib:{sysroot}/lib/x86_64-linux-gnu:{tree}/lib",
            PKG_CONFIG_PATH=f"{prefix}/lib/pkgconfig:{sysroot}/lib/x86_64-linux-gnu/pkgconfig:{tree}/lib/pkgconfig",
            TREESITTER_BINDIR=str(tree / "bin"),
            TREESITTER_INCDIR=str(tree / "include"),
            TREESITTER_LIBDIR=str(tree / "lib"),
        )

    def foundations(self) -> None:
        """Build the accepted PCRE2 source with JIT and every upstream test suite."""
        cmake = str(Path(sys.executable).parent / "cmake")
        build = self.work / "pcre2-build"
        self.command(
            "pcre2-configure",
            [
                cmake,
                "-S",
                str(self.work / "pcre2-source"),
                "-B",
                str(build),
                f"-DCMAKE_INSTALL_PREFIX={self.work}/prefix",
                "-DBUILD_SHARED_LIBS=OFF",
                "-DPCRE2_BUILD_PCRE2_8=ON",
                "-DPCRE2_BUILD_PCRE2_16=ON",
                "-DPCRE2_BUILD_PCRE2_32=ON",
                "-DPCRE2_SUPPORT_JIT=ON",
                "-DPCRE2_BUILD_TESTS=ON",
            ],
        )
        self.command("pcre2-build", [cmake, "--build", str(build), "--parallel", "4"])
        self.command(
            "pcre2-tests",
            [
                str(Path(sys.executable).parent / "ctest"),
                "--test-dir",
                str(build),
                "--output-on-failure",
            ],
            timeout=600,
        )
        self.command("pcre2-install", [cmake, "--install", str(build)])
        tree = self.source / "libs/ocaml-tree-sitter-core"
        self.command(
            "tree-sitter-patch",
            [
                "patch",
                "--batch",
                "--forward",
                str(tree / "downloads/tree-sitter-0.22.6/Makefile"),
                str(tree / "patch/tree-sitter-0.22.6/Makefile.patch"),
            ],
            cwd=tree,
        )
        self.command("tree-sitter-configure", [str(tree / "configure")], cwd=tree)
        self.command(
            "tree-sitter-build",
            [str(tree / "scripts/install-tree-sitter-lib")],
            cwd=tree,
        )

    def configure_hosted_sandbox(self, helper: Path) -> bool:
        """Enable only the verified helper on a GitHub-hosted Ubuntu 24.04 VM."""
        if (
            self.environment.get("GITHUB_ACTIONS") != "true"
            or self.environment.get("RUNNER_ENVIRONMENT") != "github-hosted"
        ):
            return False
        release = platform.freedesktop_os_release()
        if release.get("ID") != "ubuntu" or release.get("VERSION_ID") != "24.04":
            raise RuntimeError("Hosted sandbox setup requires the qualified Ubuntu runner")
        assets = [
            item for item in self.manifest["assets"]
            if item["name"] == "apparmor-profiles"
        ]
        if len(assets) != 1:
            raise ValueError("The source lock must identify one Ubuntu sandbox policy")
        source = self.work / (
            "sysroot/usr/share/apparmor/extra-profiles/bwrap-userns-restrict"
        )
        if source.is_symlink() or not source.is_file():
            raise RuntimeError("The verified Ubuntu sandbox policy is missing")
        policy = sandbox_profile(source.read_bytes(), assets[0]["profile_sha256"])
        prepared = self.work / "rezwan-native-bwrap.profile"
        prepared.write_text(policy)
        parser = Path("/usr/sbin/apparmor_parser")
        require_root_owned_path(parser)
        require_root_owned_path(HOSTED_POLICY.parent)
        for node in (HOSTED_SANDBOX, *HOSTED_SANDBOX.parents, HOSTED_POLICY):
            if node.exists() or node.is_symlink():
                require_root_owned_path(node)
        if HOSTED_POLICY.exists() and HOSTED_POLICY.read_text() != policy:
            raise RuntimeError("Refusing to replace an unrelated sandbox policy")
        self.command(
            "sandbox-helper-directory",
            [
                "/usr/bin/sudo", "-n", "/usr/bin/install", "-d",
                "--owner=root", "--group=root", "--mode=0755", "--",
                str(HOSTED_SANDBOX.parent),
            ],
        )
        require_root_owned_path(HOSTED_SANDBOX.parent)
        self.command(
            "sandbox-helper-install",
            [
                "/usr/bin/sudo", "-n", "/usr/bin/install",
                "--owner=root", "--group=root", "--mode=0555", "--",
                str(helper), str(HOSTED_SANDBOX),
            ],
        )
        self.command(
            "sandbox-policy-install",
            [
                "/usr/bin/sudo", "-n", "/usr/bin/install",
                "--owner=root", "--group=root", "--mode=0444", "--",
                str(prepared), str(HOSTED_POLICY),
            ],
        )
        require_root_owned_path(HOSTED_POLICY)
        verify_blob(
            HOSTED_POLICY.read_bytes(), hashlib.sha256(policy.encode()).hexdigest()
        )
        self.environment["PATH"] = (
            f"{HOSTED_SANDBOX.parent}:" + self.environment["PATH"]
        )
        verified_sandbox_helper(
            self.work, self.manifest, self.environment["PATH"], installed=True
        )
        self.command("sandbox-policy-parser-version", [str(parser), "--version"])
        self.command(
            "sandbox-policy-load",
            [
                "/usr/bin/sudo", "-n", str(parser), "--replace", "--skip-cache",
                str(HOSTED_POLICY),
            ],
        )
        return True

    def initialize_compiler(self) -> None:
        """Require a working sandbox before importing or compiling any package."""
        helper = verified_sandbox_helper(self.work, self.manifest, self.environment["PATH"])
        hosted_policy = self.configure_hosted_sandbox(helper)
        if hosted_policy:
            helper = verified_sandbox_helper(
                self.work, self.manifest, self.environment["PATH"], installed=True
            )
        linked = self.command("sandbox-helper-libraries", ["ldd", str(helper)])
        if "not found" in linked:
            raise RuntimeError("The bubblewrap helper requires unavailable runtime libraries")
        self.command("sandbox-helper-version", [str(helper), "--version"])
        repository = self.work / "empty-repository"
        repository.mkdir()
        (repository / "repo").write_text(
            'opam-version: "2.0"\narchive-mirrors: ["https://opam.ocaml.org/cache"]\n'
        )
        opam = str(self.work / "tools/opam")
        self.command(
            "opam-init",
            [
                opam,
                "init",
                "--bare",
                "--no-setup",
                "--no-opamrc",
                # A yes response would silently disable a failing sandbox.
                "--no",
                "locked",
                str(repository),
            ],
        )
        for phase in ("build", "install", "remove"):
            configured = self.command(
                f"opam-sandbox-{phase}-configuration",
                [opam, "option", "--global", f"wrap-{phase}-commands"],
            )
            require_sandbox_hook(configured, phase)
        self.environment["OPAM_SWITCH_PREFIX"] = str(self.work / "opam-root/scanner")
        # Opam init can exit zero even after its namespace probe failed. Run its
        # actual build hook and require success; never disable sandboxing.
        self.command(
            "opam-sandbox-check",
            [
                str(self.work / "opam-root/opam-init/hooks/sandbox.sh"),
                "build",
                "/usr/bin/true",
            ],
        )
        if hosted_policy:
            current = self.command(
                "opam-sandbox-profile",
                [
                    str(self.work / "opam-root/opam-init/hooks/sandbox.sh"),
                    "build", "/usr/bin/cat", "/proc/self/attr/current",
                    "/proc/self/status",
                ],
            )
            require_sandbox_profile(current)

    def compiler(self) -> None:
        """Import the full frozen switch from an empty local package repository."""
        self.initialize_compiler()
        opam = str(self.work / "tools/opam")
        self.command(
            "opam-frozen-import",
            [
                opam,
                "switch",
                "import",
                "--switch=scanner",
                "--yes",
                "--require-checksums",
                "--no-depexts",
                "--keep-build-dir",
                "--jobs=4",
                str(HERE / "native-switch.export"),
            ],
            timeout=3000,
        )
        installed = self.command(
            "opam-inventory",
            [
                opam,
                "list",
                "--installed",
                "--columns=name,version",
                "--separator=\t",
                "--color=never",
            ],
        )
        inventory: dict[str, str] = {}
        for line in installed.splitlines():
            if line and not line.startswith("#"):
                name, version = (part.strip() for part in line.split("\t"))
                if name in inventory:
                    raise ValueError(
                        "Installed native inventory has duplicate packages"
                    )
                inventory[name] = version
        validate_inventory(self.manifest["installed_packages"], inventory)

    def scanner(self) -> None:
        """Build the upstream scanner target and package its complete Python CLI."""
        opam = str(self.work / "tools/opam")
        self.command(
            "opengrep-core",
            [
                opam,
                "exec",
                "--",
                "dune",
                "build",
                "-j",
                "4",
                "_build/install/default/bin/opengrep-core",
                "_build/install/default/bin/opengrep-cli",
                "_build/install/default/bin/opengrep",
            ],
            cwd=self.source,
            timeout=1800,
        )
        binary = self.source / "cli/src/semgrep/bin/opengrep-core"
        binary.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(
            self.source / "_build/install/default/bin/opengrep-core", binary
        )
        binary.chmod(0o755)
        self.command("strip-scanner", ["strip", str(binary)])
        self.native.mkdir(parents=True, exist_ok=False)
        libraries = self.native / "lib"
        libraries.mkdir()
        tree = self.source / "libs/ocaml-tree-sitter-core/tree-sitter/lib"
        sysroot = self.work / "sysroot/usr/lib/x86_64-linux-gnu"
        for name, directory in (
            ("libtree-sitter.so.0", tree),
            ("libgmp.so.10", sysroot),
            ("libev.so.4", sysroot),
        ):
            shutil.copyfile((directory / name).resolve(strict=True), libraries / name)
        self.environment["LD_LIBRARY_PATH"] = str(libraries)
        linked = self.command("scanner-libraries", ["ldd", str(binary)])
        if "not found" in linked or "libpcre2" in linked:
            raise RuntimeError(
                "Native scanner did not link its verified library closure"
            )
        allowed = {
            "libtree-sitter.so.0",
            "libgmp.so.10",
            "libev.so.4",
            "libstdc++.so.6",
            "libgcc_s.so.1",
            "libm.so.6",
            "libc.so.6",
            "libdl.so.2",
            "libpthread.so.0",
            "librt.so.1",
        }
        for name in re.findall(r"^\s*(\S+) =>", linked, re.M):
            if name not in allowed:
                raise RuntimeError(f"Unrecorded native scanner library: {name}")
        wheel_output = self.work / "wheel-output"
        wheel_output.mkdir()
        self.command(
            "opengrep-wheel",
            [
                sys.executable,
                "setup.py",
                "build",
                "--build-base",
                str(self.work / "wheel-build"),
                "bdist_wheel",
                "--bdist-dir",
                str(self.work / "wheel-bdist"),
                "--dist-dir",
                str(wheel_output),
            ],
            cwd=self.source / "cli",
        )
        wheels = list(wheel_output.glob("*.whl"))
        if len(wheels) != 1:
            raise RuntimeError("Expected exactly one built OpenGrep wheel")
        self.command(
            "wheel-platform",
            [
                sys.executable,
                "-m",
                "wheel",
                "tags",
                "--platform-tag",
                "linux_x86_64",
                "--remove",
                str(wheels[0]),
            ],
        )
        wheel = next(wheel_output.glob("*.whl"))
        shutil.copyfile(wheel, self.native / wheel.name)
        (self.native / "build.json").write_text(
            json.dumps(
                {
                    "scanner": self.manifest["scanner"],
                    "installed_packages": self.manifest["installed_packages"],
                    "components": self.manifest["components"],
                    "linked_libraries": linked,
                    "stages": self.timings,
                },
                indent=2,
            )
            + "\n"
        )
        files = {
            path.relative_to(self.native).as_posix(): hashlib.sha256(
                path.read_bytes()
            ).hexdigest()
            for path in self.native.rglob("*")
            if path.is_file()
        }
        (self.native / "receipt.json").write_text(
            json.dumps({"input_sha256": self.identity, "files": files}, indent=2) + "\n"
        )


def install_wheel(destination: Path, output: Path) -> None:
    """Install only the verified local wheel without resolving new dependencies."""
    wheels = list((destination / "native").glob("*.whl"))
    if len(wheels) != 1:
        raise RuntimeError("Native cache must contain exactly one OpenGrep wheel")
    wheel = wheels[0]
    requirement = output / "opengrep-built-wheel.txt"
    digest = hashlib.sha256(wheel.read_bytes()).hexdigest()
    requirement.write_text(f"opengrep @ {wheel.as_uri()} --hash=sha256:{digest}\n")
    subprocess.run(  # noqa: S603 -- verified local wheel, no shell or resolution
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "--no-index",
            "--no-deps",
            "--require-hashes",
            "-r",
            str(requirement),
        ],
        check=True,
        timeout=300,
    )
    subprocess.run([sys.executable, "-m", "pip", "check"], check=True, timeout=120)


def main() -> int:
    """Audit every mode and compile only when a SAST build has no verified cache."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("audit", "build"))
    parser.add_argument("--destination", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    receipt: dict[str, Any] = {"status": "failed", "mode": args.mode}
    try:
        manifest = load_manifest()
        receipt["audit"] = audit(manifest, args.output / "native-dependencies.json")[
            "audited_components"
        ]
        if args.mode == "build":
            if args.destination is None:
                raise ValueError("Native scanner build requires a destination")
            if platform.system() != "Linux" or platform.machine() != "x86_64":
                raise RuntimeError("Native scanner build requires Linux x86_64")
            operating_system = platform.freedesktop_os_release()
            if (
                operating_system.get("ID") != "ubuntu"
                or operating_system.get("VERSION_ID") != "24.04"
            ):
                raise RuntimeError("Native scanner source lock targets Ubuntu 24.04")
            destination = args.destination.resolve()
            hit = verify_cache(destination / "native", input_identity())
            receipt["cache_hit"] = hit
            if not hit:
                builder = Builder(destination, args.output, manifest)
                builder.prepare()
                builder.foundations()
                builder.compiler()
                builder.scanner()
            if not verify_cache(destination / "native", input_identity()):
                raise RuntimeError(
                    "Native scanner build did not create a verified cache"
                )
            install_wheel(destination, args.output)
        receipt["status"] = "passed"
        return 0
    except (
        OSError,
        RuntimeError,
        ValueError,
        KeyError,
        subprocess.SubprocessError,
        tarfile.TarError,
    ) as error:
        receipt["error"] = f"{type(error).__name__}: {error}"
        LOGGER.error("Native scanner operation failed: %s", receipt["error"])
        return 1
    finally:
        receipt["duration_seconds"] = time.monotonic() - started
        (args.output / "native-scanner-status.json").write_text(
            json.dumps(receipt, indent=2) + "\n"
        )


if __name__ == "__main__":
    raise SystemExit(main())
