#!/usr/bin/env python3
"""Run security gates and retain commands, coverage, reports and nonzero outcomes."""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import logging
import os
import pathlib
import re
import shutil
import subprocess
import tempfile
import time
from typing import Any

from dependencies import expand_local_editable, manifests_for
from report_validation import inspect_findings, inspect_npm, inspect_pip, inspect_trivy

ROOT = pathlib.Path(__file__).resolve().parents[2]
SKIP_PARTS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    "hardening-artifacts",
    ".pytest_cache",
    ".security-tools",
}
LOGGER = logging.getLogger(__name__)


def relative(path: pathlib.Path) -> str:
    """Format an evidence path relative to this repository."""
    return path.relative_to(ROOT).as_posix()


def source_files() -> list[pathlib.Path]:
    """List tracked and nonignored regular source files without following links."""
    result = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],  # noqa: S607 -- trusted runner Git
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return sorted(
        {
            ROOT / name
            for name in result.stdout.split("\0")
            if name
            and not SKIP_PARTS.intersection(pathlib.PurePosixPath(name).parts)
            and (ROOT / name).is_file()
            and not (ROOT / name).is_symlink()
        }
    )


def inspect_semgrep(report: dict[str, Any], expected: set[str]) -> dict[str, int]:
    """Require successful analysis of every authored Python and JS/TS target."""
    if not isinstance(report.get("errors"), list) or report["errors"]:
        raise ValueError("Semgrep errors are missing or nonempty; analysis is incomplete")
    if not isinstance(report.get("results"), list):
        raise ValueError("Semgrep finding results are missing or malformed")
    paths = report.get("paths")
    if not isinstance(paths, dict) or not isinstance(paths.get("scanned"), list):
        raise ValueError("Semgrep analyzed-target evidence is missing")
    scanned = paths["scanned"]
    if not scanned or any(not isinstance(name, str) for name in scanned):
        raise ValueError("Semgrep analyzed targets must be nonempty path strings")
    missing = expected.difference(scanned)
    if missing:
        raise ValueError(f"Semgrep omitted authored source targets: {sorted(missing)}")
    return {
        "analyzed_targets": len(set(scanned)),
        "expected_source_targets": len(expected),
        "findings": len(report["results"]),
        "analysis_errors": 0,
    }


def source_snapshot() -> dict[str, str]:
    """Hash actual tracked and nonignored candidate bytes, including new files."""
    return {
        relative(path): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in source_files()
    }


class Gate:
    """Execute fixed scanner commands and retain a machine-readable receipt."""

    def __init__(self, mode: str, tools: pathlib.Path) -> None:
        """Create an artifact directory and empty receipts for one mandatory gate."""
        self.mode = mode
        self.tools = tools.resolve()
        parent = ROOT / "hardening-artifacts" / mode
        parent.mkdir(parents=True, exist_ok=True)
        # Keep each execution isolated: a previous report can never satisfy this run.
        self.out = pathlib.Path(tempfile.mkdtemp(prefix="run-", dir=parent))
        self.checks: list[dict[str, Any]] = []
        self.coverage: dict[str, Any] = {}

    def bind_sources(self) -> None:
        """Record the exact input bytes before a scanner or language quality run."""
        self.coverage["source_sha256"] = source_snapshot()

    def verify_sources(self) -> None:
        """Reject results when source files are added, removed or changed during a run."""
        before = self.coverage["source_sha256"]
        after = source_snapshot()
        changed = sorted(
            name for name in before.keys() | after.keys()
            if before.get(name) != after.get(name)
        )
        self.coverage["source_changed_during_scan"] = changed
        if changed:
            raise RuntimeError("Source changed during validation; rerun the exact candidate")

    def run(
        self,
        name: str,
        command: list[str],
        cwd: pathlib.Path = ROOT,
        *,
        stdout_json: bool = False,
        timeout: int = 900,
        environment_overrides: dict[str, str] | None = None,
    ) -> None:
        """Execute one fixed argv and preserve its stdout, stderr and outcome."""
        started = time.monotonic()
        environment = (
            None if environment_overrides is None else {**os.environ, **environment_overrides}
        )
        try:
            # Only scanner argv assembled below is executed. shell=True is never used.
            result = subprocess.run(  # noqa: S603
                command, cwd=cwd, text=True, capture_output=True, timeout=timeout,
                env=environment,
            )
            code, stdout, stderr = result.returncode, result.stdout, result.stderr
        except (OSError, subprocess.TimeoutExpired) as error:
            code, stdout, stderr = 2, "", f"{type(error).__name__}: {error}"
        suffix = "json" if stdout_json else "stdout.log"
        (self.out / f"{name}.{suffix}").write_text(stdout)
        (self.out / f"{name}.stderr.log").write_text(stderr)
        self.checks.append(
            {
                "name": name,
                "command": command,
                "directory": relative(cwd),
                "exit_code": code,
                "seconds": round(time.monotonic() - started, 3),
                "status": "passed" if code == 0 else "failed",
            }
        )
        LOGGER.info("%s: %s (exit %s)", name, "passed" if code == 0 else "FAILED", code)

    def inspect_report(self, name: str, scanner: str, expected: set[str] | None = None) -> None:
        """Retain independent report validation without hiding other scanner outcomes."""
        try:
            report = json.loads((self.out / f"{name}.json").read_text())
            if scanner in {"zizmor", "gitleaks"}:
                counts = inspect_findings(report, scanner)
            elif scanner == "pip-audit":
                counts = inspect_pip(report)
            elif scanner == "npm":
                counts = inspect_npm(report)
            elif scanner == "trivy":
                counts = inspect_trivy(report, expected or set())
            else:
                raise ValueError(f"Unknown report validator: {scanner}")
            self.coverage.setdefault("report_validation", {})[name] = counts
            code = 1 if counts["blocking_findings"] else 0
            check = {"name": f"{name}-report", "exit_code": code,
                     "status": "failed" if code else "passed"}
        except (OSError, ValueError, TypeError) as error:
            check = {"name": f"{name}-report", "exit_code": 2, "status": "failed",
                     "error": f"{type(error).__name__}: {error}"}
        self.checks.append(check)

    def workflow(self) -> None:
        """Validate workflow syntax and offline security rules."""
        workflows = sorted((ROOT / ".github/workflows").glob("*.y*ml"))
        if not workflows:
            raise RuntimeError("No workflows found; workflow scan has no target")
        self.run(
            "actionlint",
            [
                str(self.tools / "actionlint"),
                "-format",
                "{{json .}}",
                *map(str, workflows),
            ],
        )
        self.run(
            "zizmor-offline",
            [
                str(self.tools / "venv/bin/zizmor"),
                "--offline",
                "--strict-collection",
                "--no-progress",
                "--format",
                "json",
                str(ROOT / ".github/workflows"),
            ],
            stdout_json=True,
        )
        self.inspect_report("zizmor-offline", "zizmor")

    def secrets(self, files: list[pathlib.Path]) -> None:
        """Scan reachable history and the source snapshot with redacted output."""
        self.run(
            "gitleaks-history",
            [
                str(self.tools / "gitleaks"),
                "git",
                ".",
                "--log-opts=--all",
                "--config",
                ".gitleaks.toml",
                "--redact=100",
                "--report-format",
                "json",
                "--report-path",
                str(self.out / "gitleaks-history.json"),
                "--no-banner",
            ],
        )
        self.inspect_report("gitleaks-history", "gitleaks")
        # Snapshot source only, excluding dependency/report directories and symlinks.
        with tempfile.TemporaryDirectory(prefix="rezwan-secret-source-") as temporary:
            snapshot = pathlib.Path(temporary)
            for source in files:
                target = snapshot / relative(source)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target, follow_symlinks=False)
            self.run(
                "gitleaks-working-tree",
                [
                    str(self.tools / "gitleaks"),
                    "dir",
                    str(snapshot),
                    "--config",
                    str(ROOT / ".gitleaks.toml"),
                    "--redact=100",
                    "--report-format",
                    "json",
                    "--report-path",
                    str(self.out / "gitleaks-working-tree.json"),
                    "--no-banner",
                ],
            )
            self.inspect_report("gitleaks-working-tree", "gitleaks")
            report_path = self.out / "gitleaks-working-tree.json"
            if report_path.exists():
                findings = json.loads(report_path.read_text())
                for finding in findings:
                    finding["File"] = finding.get("File", "").removeprefix(str(snapshot) + "/")
                report_path.write_text(json.dumps(findings, indent=2) + "\n")

    def sast(self) -> None:
        """Run registered security rules and local forbidden-operation rules."""
        self.run(
            "semgrep",
            [
                str(self.tools / "venv/bin/semgrep"),
                "scan",
                "--config",
                "p/security-audit",
                "--config",
                ".semgrep.yml",
                "--strict",
                "--error",
                "--metrics",
                "off",
                "--disable-version-check",
                "--jobs",
                "1",
                "--max-memory",
                "4096",
                "--timeout",
                "180",
                "--max-target-bytes",
                "0",
                "--json-output",
                str(self.out / "semgrep.json"),
                ".",
            ],
            timeout=1800,
        )
        expected = {
            relative(path)
            for path in source_files()
            if path.suffix in {".py", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"}
        }
        report = json.loads((self.out / "semgrep.json").read_text())
        self.coverage["semgrep_analysis"] = inspect_semgrep(report, expected)
        if self.coverage["semgrep_analysis"]["findings"]:
            self.checks.append({"name": "semgrep-findings", "exit_code": 1, "status": "failed"})

    def trivy(self) -> None:
        """Fail on HIGH/CRITICAL vulnerabilities, misconfigurations or scan errors."""
        self.run(
            "trivy",
            [
                str(self.tools / "trivy"),
                "fs",
                "--config",
                "trivy.yaml",
                "--disable-telemetry",
                "--include-dev-deps",
                "--output",
                str(self.out / "trivy.json"),
                ".",
            ],
            timeout=1200,
        )
        expected = {
            relative(path) for path in source_files()
            if path.name == "package-lock.json"
            or relative(path) == ".github/security/requirements.txt"
        }
        self.inspect_report("trivy", "trivy", expected)

    def dependencies(self, files: list[pathlib.Path]) -> None:
        """Audit every Python declaration, requirements file and npm lockfile."""
        pyprojects = [p for p in files if p.name == "pyproject.toml"]
        requirements = [
            p for p in files if p.name.startswith("requirements") and p.suffix in {".txt", ".lock"}
        ]
        npm_locks = [p for p in files if p.name == "package-lock.json"]
        declarations = [manifest for path in pyprojects for manifest in manifests_for(path)]
        self.coverage.update(
            {
                "python_pyprojects": list(map(relative, pyprojects)),
                "python_declarations": [
                    {
                        "source": relative(item.source),
                        "kind": item.kind,
                        "direct_requirements": len(item.requirements),
                    }
                    for item in declarations
                ],
                "python_requirements": list(map(relative, requirements)),
                "npm_locks": list(map(relative, npm_locks)),
                "python_dependency_resolution": (
                    "Static runtime, optional, build and PEP 735 dependency groups are "
                    "resolved separately, including tool-only pyprojects. All adjacent "
                    "requirements text/lock files are audited. Dynamic declarations "
                    "fail closed. Resolution is current; scanner dependencies "
                    "are hash locked. PIP_IGNORE_INSTALLED=1 includes dependencies "
                    "already present in pip-audit's isolated resolver environment."
                ),
            }
        )
        if not declarations and not requirements and not npm_locks:
            raise RuntimeError("No dependency declarations found; dependency scan has no target")
        generated = self.out / "manifests"
        generated.mkdir(exist_ok=True)
        audits: list[tuple[str, pathlib.Path, pathlib.Path]] = []
        for index, declaration in enumerate(declarations):
            safe_kind = re.sub(r"[^a-zA-Z0-9_-]", "-", declaration.kind)
            name = f"pip-declaration-{index}-{safe_kind}"
            manifest = generated / f"{name}.txt"
            manifest.write_text("\n".join(declaration.requirements) + "\n")
            audits.append((name, manifest, declaration.source.parent))
        editable_expansions: list[dict[str, Any]] = []
        for index, requirement in enumerate(requirements):
            expanded = expand_local_editable(requirement)
            manifest = requirement
            if expanded is not None:
                manifest = generated / f"pip-requirements-{index}-static-editable.txt"
                manifest.write_text("\n".join(expanded) + "\n")
                editable_expansions.append(
                    {
                        "source": relative(requirement),
                        "metadata": relative(requirement.parent / "pyproject.toml"),
                        "expanded_manifest": relative(manifest),
                        "direct_requirements": len(expanded),
                        "method": "static runtime and requested extras; build separately audited",
                    }
                )
            audits.append((f"pip-requirements-{index}", manifest, requirement.parent))
        self.coverage["static_editable_expansions"] = editable_expansions
        for name, requirement, directory in audits:
            self.run(
                name,
                [
                    str(self.tools / "venv/bin/pip-audit"),
                    "--strict",
                    "--progress-spinner",
                    "off",
                    "--format",
                    "json",
                    "--output",
                    str(self.out / f"{name}.json"),
                    "-r",
                    str(requirement),
                ],
                cwd=directory,
                # pip-audit bootstraps setuptools/wheel before its dry-run report.
                # Resolve them again so unconditional build requirements are audited.
                environment_overrides={"PIP_IGNORE_INSTALLED": "1"},
            )
            self.inspect_report(name, "pip-audit")
        for index, lock in enumerate(npm_locks):
            self.run(
                f"npm-{index}",
                [
                    "npm",
                    "audit",
                    "--package-lock-only",
                    "--ignore-scripts",
                    "--audit-level=high",
                    "--json",
                ],
                cwd=lock.parent,
                stdout_json=True,
            )
            self.inspect_report(f"npm-{index}", "npm")

    def execute(self) -> int:
        """Run the requested gate and retain failed and unavailable outcomes."""
        revision = "unresolved"
        try:
            revision = subprocess.check_output(
                ["git", "rev-parse", "HEAD"],  # noqa: S607 -- trusted runner Git
                cwd=ROOT,
                text=True,
            ).strip()
            files = source_files()
            source_hashes = {
                relative(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in files
            }
            self.coverage["source_sha256"] = source_hashes
            self.coverage.update(
                {
                    "tracked_and_untracked_source_files": len(files),
                    "python_files": sum(p.suffix == ".py" for p in files),
                    "javascript_typescript_files": sum(
                        p.suffix in {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"} for p in files
                    ),
                    "matlab_files": sum(p.suffix == ".m" for p in files),
                    "unsupported_by_codeql_and_semgrep": [
                        "MATLAB/Simulink source; see its separate numerical gate"
                    ],
                    "secret_scope": (
                        "All reachable Git refs plus tracked and nonignored regular "
                        "source files; symlink targets and generated dependency/report "
                        "directories excluded"
                    ),
                    "zizmor_scope": (
                        "Offline rules; remote advisory/action checks are not covered"
                    ),
                }
            )
            if self.mode == "workflow":
                self.workflow()
            elif self.mode == "secrets":
                self.secrets(files)
            elif self.mode == "sast":
                self.sast()
            elif self.mode == "trivy":
                self.trivy()
            elif self.mode == "dependencies":
                self.dependencies(files)
            after_hashes = {
                relative(path): hashlib.sha256(path.read_bytes()).hexdigest()
                for path in source_files()
            }
            changed = sorted(
                name
                for name in source_hashes.keys() | after_hashes.keys()
                if source_hashes.get(name) != after_hashes.get(name)
            )
            self.coverage["source_changed_during_scan"] = changed
            if changed:
                raise RuntimeError("Source changed during scanning; rerun the exact candidate")
        except Exception as error:
            self.checks.append(
                {
                    "name": "gate-runtime",
                    "exit_code": 2,
                    "status": "failed",
                    "error": f"{type(error).__name__}: {error}",
                }
            )
        failed = not self.checks or any(check["exit_code"] != 0 for check in self.checks)
        report = {
            "schema_version": 1,
            "mode": self.mode,
            "utc": datetime.datetime.now(datetime.UTC).isoformat(),
            "revision": revision,
            "status": "failed" if failed else "passed",
            "coverage": self.coverage,
            "checks": self.checks,
        }
        (self.out / "summary.json").write_text(json.dumps(report, indent=2) + "\n")
        return 1 if failed else 0


def main() -> int:
    """Dispatch a mandatory scanner gate without converting absence into success."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["workflow", "secrets", "sast", "dependencies", "trivy"])
    parser.add_argument(
        "--tools",
        type=pathlib.Path,
        default=pathlib.Path(os.environ.get("SECURITY_TOOL_DIR", ".security-tools")),
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    os.chdir(ROOT)
    return Gate(args.mode, args.tools).execute()


if __name__ == "__main__":
    raise SystemExit(main())
