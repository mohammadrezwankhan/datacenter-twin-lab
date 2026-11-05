#!/usr/bin/env python3
"""Execute mandatory language quality checks and record their real outcomes."""

from __future__ import annotations

import argparse
import datetime
import json
import logging
import os
import pathlib
import sys
import tomllib
from typing import Any

from coverage_gate import counts, executed_cases, expected_sources, inspect_core
from dependencies import expand_group, strings, table
from run import ROOT, Gate

LOGGER = logging.getLogger(__name__)
MODES = (
    "python-lint",
    "python-types",
    "python-tests",
    "browser-lint",
    "browser-types",
    "browser-format",
    "browser-tests",
)


def install_python(gate: Gate, config: dict[str, Any]) -> None:
    """Install declared development tools and explicit project test dependencies."""
    with (ROOT / "pyproject.toml").open("rb") as source:
        data = tomllib.load(source)
    groups = table(data.get("dependency-groups"), "dependency-groups")
    dependencies = expand_group(groups, "dev")
    if not dependencies:
        raise ValueError("The development dependency group is empty")
    command = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check"]
    command.extend(dependencies)
    for requirement in strings(config.get("requirements", []), "requirements"):
        path = ROOT / requirement
        if not path.is_file():
            raise ValueError(f"Required dependency manifest is missing: {requirement}")
        command.extend(["-r", str(path)])
    for project in strings(config.get("projects", []), "projects"):
        directory = project.split("[", maxsplit=1)[0]
        with (ROOT / directory / "pyproject.toml").open("rb") as source:
            project_data = tomllib.load(source)
        if not table(project_data.get("project"), "installable project").get("name"):
            raise ValueError(f"{directory} is not an installable project")
        command.extend(["--editable", project])
    gate.run("install-python-development", command, timeout=900)
    if gate.checks[-1]["exit_code"] != 0:
        raise RuntimeError("Python development dependencies could not be installed")


def python_check(gate: Gate, config: dict[str, Any], mode: str) -> None:
    """Run lint, strict types, or the complete configured Python test targets."""
    if mode == "python-lint":
        gate.coverage["lint_scope"] = "Repository-wide ruff check . with pyproject rules"
        gate.run("ruff", [sys.executable, "-m", "ruff", "check", "."])
    elif mode == "python-types":
        gate.coverage["type_scope"] = "pyproject.toml tool.mypy.files, with --strict"
        gate.run("mypy", [sys.executable, "-m", "mypy", "--strict"], timeout=1200)
        gate.run(
            "security-helper-types",
            [
                sys.executable,
                "-m",
                "mypy",
                "--strict",
                "--python-version",
                "3.12",
                ".github/security",
            ],
        )
    else:
        targets = strings(config.get("test_targets"), "test_targets")
        sources = strings(config.get("coverage_sources"), "coverage_sources")
        if not targets or not sources:
            raise ValueError("Test targets and coverage sources must be nonempty")
        for target in [*targets, *sources]:
            if not (ROOT / target).exists():
                raise ValueError(f"Required test or coverage target is missing: {target}")
        gate.coverage.update({"test_targets": targets, "coverage_sources": sources})
        command = [sys.executable, "-m", "pytest", *targets, "--cov-branch"]
        command.extend(f"--cov={source}" for source in sources)
        command.extend(
            [
                "--cov-report=term-missing",
                f"--cov-report=xml:{gate.out / 'coverage.xml'}",
                f"--cov-report=json:{gate.out / 'coverage.json'}",
                f"--junitxml={gate.out / 'junit.xml'}",
            ]
        )
        gate.run("pytest-coverage", command, timeout=2400)
        report_path = gate.out / "coverage.json"
        if not report_path.is_file():
            raise RuntimeError("Python tests produced no coverage JSON report")
        report = table(json.loads(report_path.read_text()), "coverage report")
        totals = counts(report.get("totals"), "aggregate coverage totals")
        gate.coverage["aggregate_including_tooling"] = totals
        gate.coverage["test_cases"] = executed_cases(gate.out / "junit.xml")
        if totals["num_statements"] <= 0 or totals["covered_lines"] <= 0:
            raise RuntimeError("Python test coverage contains no executed source lines")
        kind = config.get("coverage_kind")
        if kind == "numerical-core":
            core_sources = strings(config.get("numerical_core_sources"), "numerical_core_sources")
            expected = expected_sources(ROOT, core_sources)
            core = inspect_core(report, expected)
            gate.coverage["numerical_core"] = core
            gate.coverage["threshold_policy"] = "Numerical core line >=95% AND branch >=95%"
            if core["status"] != "passed":
                raise RuntimeError("Numerical core requires at least 95% lines AND 95% branches")
        elif kind == "tooling":
            if config.get("numerical_core_sources"):
                raise ValueError("Tooling coverage must not declare a numerical Python core")
            gate.coverage["threshold_policy"] = (
                "Tooling execution only; no Python numerical coverage claim. "
                "MATLAB coverage, when applicable, requires its separate MATLAB gate."
            )
        else:
            raise ValueError("Coverage policy must explicitly identify numerical-core or tooling")


def browser_check(gate: Gate, config: dict[str, Any], mode: str, install: bool) -> None:
    """Run the root package's mandatory browser quality script."""
    if not (ROOT / "package-lock.json").is_file():
        raise RuntimeError("Browser quality requires the committed package lock")
    if install:
        gate.run("npm-ci", ["npm", "ci", "--ignore-scripts"], timeout=900)
        if gate.checks[-1]["exit_code"] != 0:
            raise RuntimeError("Browser development dependencies could not be installed")
        projects = strings(
            config.get("browser_project_directories", []), "browser_project_directories"
        )
        for index, project in enumerate(projects):
            directory = (ROOT / project).resolve()
            if (
                not directory.is_relative_to(ROOT)
                or not (directory / "package-lock.json").is_file()
            ):
                raise ValueError(f"Browser project needs a repository lockfile: {project}")
            gate.run(
                f"npm-ci-project-{index}",
                ["npm", "ci", "--ignore-scripts"],
                cwd=directory,
                timeout=900,
            )
            if gate.checks[-1]["exit_code"] != 0:
                raise RuntimeError(f"Browser project dependencies could not install: {project}")
    scripts = {
        "browser-lint": "quality:lint",
        "browser-types": "quality:typecheck",
        "browser-format": "quality:format",
        "browser-tests": "quality:browser",
    }
    gate.coverage["package_script"] = scripts[mode]
    gate.run(scripts[mode].replace(":", "-"), ["npm", "run", scripts[mode]], timeout=1200)


def main() -> int:
    """Preserve command receipts on success, findings, or unavailable tooling."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=MODES)
    parser.add_argument("--install", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    gate = Gate(args.mode, pathlib.Path(sys.executable).parent)
    try:
        gate.bind_sources()
        config = table(
            json.loads((ROOT / ".github/security/quality.json").read_text()),
            "quality configuration",
        )
        python_paths = strings(config.get("python_paths", []), "python_paths")
        resolved = [ROOT / path for path in python_paths]
        if any(not path.is_dir() or not path.resolve().is_relative_to(ROOT) for path in resolved):
            raise ValueError("Python import paths must be existing repository directories")
        os.environ["PYTHONPATH"] = os.pathsep.join([str(ROOT), *(str(path) for path in resolved)])
        if args.mode.startswith("python-"):
            if args.install:
                install_python(gate, config)
            python_check(gate, config, args.mode)
        else:
            browser_check(gate, config, args.mode, args.install)
        gate.verify_sources()
    except (OSError, ValueError, KeyError, TypeError, RuntimeError) as error:
        gate.checks.append(
            {
                "name": "quality-runtime",
                "status": "failed",
                "exit_code": 2,
                "error": f"{type(error).__name__}: {error}",
            }
        )
        LOGGER.error("Quality gate failed: %s", error)
    success = bool(gate.checks) and all(item["exit_code"] == 0 for item in gate.checks)
    receipt = {
        "mode": args.mode,
        "status": "passed" if success else "failed",
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "coverage": gate.coverage,
        "checks": gate.checks,
    }
    (gate.out / "summary.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
