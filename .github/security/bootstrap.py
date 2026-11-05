#!/usr/bin/env python3
"""Install development scanners using checked release digests and package hashes."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import logging
import pathlib
import platform
import subprocess
import tarfile
import urllib.parse
import urllib.request
import venv
from typing import Any

HERE = pathlib.Path(__file__).resolve().parent
LOGGER = logging.getLogger(__name__)


def install_binary(name: str, spec: dict[str, str], destination: pathlib.Path) -> dict[str, str]:
    """Download an HTTPS release and extract only its expected regular executable."""
    if urllib.parse.urlsplit(spec["url"]).scheme != "https":
        raise ValueError("Scanner release URLs must use HTTPS")
    request = urllib.request.Request(  # noqa: S310 -- HTTPS checked immediately above
        spec["url"], headers={"User-Agent": "Rezwan-security-bootstrap"}
    )
    # This exact fetch is reviewed: HTTPS is required and bytes cannot be executed
    # unless their SHA-256 matches the checked release manifest. Contract tests
    # reject HTTP URLs, tampered archives and symbolic executable members.
    # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310
        blob = response.read()
    actual = hashlib.sha256(blob).hexdigest()
    if actual != spec["sha256"]:
        raise RuntimeError(f"{name}: release digest mismatch; refusing to execute")
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as archive:
        matches = [
            member for member in archive.getmembers() if member.name == name and member.isfile()
        ]
        if len(matches) != 1:
            raise RuntimeError(f"{name}: expected one regular executable in archive")
        source = archive.extractfile(matches[0])
        if source is None:
            raise RuntimeError(f"{name}: executable missing")
        executable = destination / name
        executable.write_bytes(source.read())
        executable.chmod(0o755)
    return {
        "tool": name,
        "version": spec["version"],
        "url": spec["url"],
        "sha256": actual,
    }


def main() -> int:
    """Install only the scanners required by the selected gate and save a receipt."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mode", choices=["workflow", "secrets", "sast", "dependencies", "trivy", "all"]
    )
    parser.add_argument("--destination", type=pathlib.Path, required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    receipt_dir = pathlib.Path("hardening-artifacts")
    receipt_dir.mkdir(exist_ok=True)
    receipt: dict[str, Any] = {
        "mode": args.mode,
        "status": "failed",
        "verified_installations": [],
    }
    try:
        if platform.system() != "Linux" or platform.machine() not in {
            "x86_64",
            "AMD64",
        }:
            raise RuntimeError("Verified binary bundles currently support Linux x86_64 only")
        destination = args.destination.resolve()
        destination.mkdir(parents=True, exist_ok=True)
        required = {
            "workflow": ["actionlint"],
            "secrets": ["gitleaks"],
            "trivy": ["trivy"],
        }.get(args.mode, [])
        if args.mode == "all":
            required = ["actionlint", "gitleaks", "trivy"]
        manifest = json.loads((HERE / "binaries.json").read_text())
        for name in required:
            receipt["verified_installations"].append(
                install_binary(name, manifest[name], destination)
            )
        if args.mode in {"workflow", "sast", "dependencies", "all"}:
            if platform.python_version_tuple()[:2] != ("3", "12"):
                raise RuntimeError("The scanner lock requires Python 3.12")
            environment = destination / "venv"
            venv.EnvBuilder(with_pip=True).create(environment)
            command = [
                str(environment / "bin/python"),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--require-hashes",
                "-r",
                str(HERE / "requirements.txt"),
            ]
            # argv is local fixed tooling; no shell or untrusted command string is used.
            subprocess.run(command, check=True, timeout=900)  # noqa: S603
            receipt["verified_installations"].append(
                {
                    "tool": "python-scanner-environment",
                    "lock_sha256": hashlib.sha256(
                        (HERE / "requirements.txt").read_bytes()
                    ).hexdigest(),
                    "python": platform.python_version(),
                }
            )
        receipt["status"] = "passed"
        LOGGER.info("Installed verified %s scanner environment", args.mode)
        return 0
    except (
        OSError,
        RuntimeError,
        ValueError,
        subprocess.SubprocessError,
        tarfile.TarError,
    ) as error:
        receipt["error"] = f"{type(error).__name__}: {error}"
        LOGGER.error("Scanner installation failed: %s", error)
        return 1
    finally:
        (receipt_dir / f"bootstrap-{args.mode}.json").write_text(
            json.dumps(receipt, indent=2) + "\n"
        )


if __name__ == "__main__":
    raise SystemExit(main())
