"""Exercise the installed Python CLI and custom core before accepting a native build."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from native_scanner import run_process


def error_kind(error: dict[str, Any], case: dict[str, Any]) -> str:
    """Recognize the pinned native schema without concealing structured parse errors."""
    kind = error.get("type")
    if isinstance(kind, str) and kind != "PartialParsing":
        return kind
    if (
        not isinstance(kind, list)
        or len(kind) != 2
        or kind[0] != "PartialParsing"
        or not isinstance(kind[1], list)
        or not kind[1]
    ):
        raise ValueError("Scanner error has an unknown or incomplete structured type")
    for location in kind[1]:
        if not isinstance(location, dict) or location.get("path") != case.get("error_file"):
            raise ValueError("Partial parser failure is missing its exact target location")
        for name in ("start", "end"):
            position = location.get(name)
            if (
                not isinstance(position, dict)
                or type(position.get("line")) is not int
                or position["line"] < 1
            ):
                raise ValueError("Partial parser failure has malformed source positions")
    return "PartialParsing"


def inspect_case(report: object, exit_code: int, case: dict[str, Any]) -> dict[str, int]:
    """Require the precise findings, error family, exit status and target scope."""
    if exit_code != case["exit_code"] or not isinstance(report, dict):
        raise ValueError("Native CLI contract has a wrong exit status or missing report")
    errors = report.get("errors")
    results = report.get("results")
    paths = report.get("paths")
    if not isinstance(errors, list) or not isinstance(results, list) or not isinstance(paths, dict):
        raise ValueError("Native CLI contract is missing its complete JSON schema")
    scanned = paths.get("scanned")
    if not isinstance(scanned, list) or not all(isinstance(name, str) and name for name in scanned):
        raise ValueError("Native CLI contract has no complete target inventory")
    expected_errors = set(case.get("error_types", []))
    if bool(errors) != bool(expected_errors) or any(
        not isinstance(error, dict)
        or error_kind(error, case) not in expected_errors
        or error.get("code") != case["exit_code"]
        for error in errors
    ):
        raise ValueError("Native CLI contract has unexpected or missing parser errors")
    if expected_errors:
        if "error_rule_id" in case:
            if any(
                error.get("rule_id") != case["error_rule_id"]
                or error.get("code") != case["exit_code"]
                for error in errors
            ):
                raise ValueError("Native CLI contract reports an unrelated invalid rule")
        elif any(error.get("path") != case["error_file"] for error in errors):
            raise ValueError("Native CLI contract reports an unrelated failure")
    if not expected_errors and set(scanned) != set(case["scanned_paths"]):
        raise ValueError("Native CLI contract omitted or added an unexpected target")
    findings: list[tuple[str, str, int]] = []
    for result in results:
        if (
            not isinstance(result, dict)
            or not isinstance(result.get("check_id"), str)
            or not isinstance(result.get("path"), str)
            or not isinstance(result.get("start"), dict)
            or not isinstance(result["start"].get("line"), int)
        ):
            raise ValueError("Native CLI contract has malformed finding locations")
        findings.append((result["check_id"], result["path"], result["start"]["line"]))
    expected = sorted(tuple(value) for value in case.get("findings", []))
    if sorted(findings) != expected:
        raise ValueError("Native CLI contract lost, changed or added a required finding")
    return {"findings": len(findings), "errors": len(errors), "scanned_paths": len(scanned)}


def rule_ids_from_profile(report: object, expected: list[str]) -> list[str]:
    """Require every configured fixture rule in the actual scan's profile."""
    timing = report.get("time") if isinstance(report, dict) else None
    ids = timing.get("rules") if isinstance(timing, dict) else None
    if (
        not expected
        or len(expected) != len(set(expected))
        or not isinstance(ids, list)
        or not all(isinstance(rule, str) and rule for rule in ids)
        or len(ids) != len(set(ids))
        or sorted(ids) != sorted(expected)
    ):
        raise ValueError("Native scan profile omitted, duplicated or changed a fixture rule")
    return sorted(ids)


def scan_arguments(scanner: Path, configs: list[str], report: Path) -> list[str]:
    """Use the production flags verbatim for all actual CLI regression probes."""
    return [
        str(scanner),
        "scan",
        *[part for config in configs for part in ("--config", config)],
        "--strict",
        "--error",
        "--disable-version-check",
        "--jobs",
        "1",
        "--max-memory",
        "4096",
        "--timeout",
        "180",
        "--max-target-bytes",
        "0",
        "--time",
        "--json-output",
        str(report),
        ".",
    ]


def run_case(scanner: Path, output: Path, case: dict[str, Any]) -> dict[str, Any]:
    """Run one isolated source fixture; fixture source is never executed."""
    name = case["id"]
    if not isinstance(name, str) or re.fullmatch(r"[a-z0-9_-]+", name) is None:
        raise ValueError("Native CLI case identity must be a simple name")
    case_output = output / name
    case_output.mkdir()
    environment = dict(os.environ)
    with tempfile.TemporaryDirectory(prefix="rezwan-native-control-") as temporary:
        root = Path(temporary)
        files = dict(case["files"])
        for config, rules in enumerate(case["configs"]):
            files[f"rules{config}.json"] = json.dumps(rules, indent=2) + "\n"
        for filename, content in files.items():
            if re.fullmatch(r"[a-zA-Z0-9_.-]+", filename) is None:
                raise ValueError("Native CLI fixture paths must be flat local filenames")
            (root / filename).write_text(content)
        hashes = {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in root.iterdir()
            if path.is_file()
        }
        report_path = case_output / "report.json"
        command = scan_arguments(
            scanner,
            [f"rules{i}.json" for i in range(len(case["configs"]))],
            report_path,
        )
        process = run_process(command, cwd=root, environment=environment, timeout=300)
        (case_output / "stdout.log").write_text(process.stdout)
        (case_output / "stderr.log").write_text(process.stderr)
        after = {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in root.iterdir()
            if path.is_file()
        }
        (case_output / "execution.json").write_text(
            json.dumps({
                "id": name, "exit_code": process.returncode, "command": command,
                "source_sha256": hashes, "after_source_sha256": after,
            }, indent=2) + "\n"
        )
        if after != hashes:
            raise RuntimeError("The native scanner modified its source fixtures")
        report = json.loads(report_path.read_text())
        counts = inspect_case(report, process.returncode, case)
        configured_rules = [rule["id"] for config in case["configs"] for rule in config["rules"]]
        applicable_rules = (
            rule_ids_from_profile(report, configured_rules) if not case.get("error_types") else []
        )
        return {
            "id": name,
            "status": "passed",
            "exit_code": process.returncode,
            "source_sha256": hashes,
            "command": command,
            "applicable_rule_ids": applicable_rules,
            **counts,
        }


def python_cases(fixtures: dict[str, Any]) -> list[dict[str, Any]]:
    """Bind each native Python probe to the independently reviewed AST fixtures."""
    cases: list[dict[str, Any]] = []
    clean = {
        "rules": [
            {
                "id": "rezwan-parse-control",
                "languages": ["python"],
                "message": "Parser control",
                "severity": "WARNING",
                "pattern": "rezwan_never_called_parse_marker(...)",
            }
        ]
    }
    # The stable core can skip an irrelevant fixed-literal rule before parsing.
    # Keep every original configuration and add a separate zero-finding rule
    # without required literals. Its positive expression pattern forces parsing;
    # the identical exclusion removes findings, not syntax errors. The exact
    # malformed-source controls must still fail if parsing is ever skipped.
    parse_control = {
        "rules": [
            {
                "id": "rezwan-force-parser-control",
                "languages": ["python"],
                "message": "Require Python parser traversal",
                "severity": "WARNING",
                "patterns": [{"pattern": "$X"}, {"pattern-not": "$X"}],
            }
        ]
    }
    for fixture in fixtures["fixtures"]:
        source = fixture["source"]
        if hashlib.sha256(source.encode()).hexdigest() != fixture["source_sha256"]:
            raise ValueError("Python parser fixture differs from its reviewed source hash")
        filename = fixture["id"] + ".py"
        invalid = fixture["expect_parse"] == "reject"
        findings = [
            [finding["rule_id"], filename, finding["line"]]
            for finding in fixture.get("expected_findings", [])
        ]
        rules = (
            fixtures["rulesets"][fixture["native_ruleset"]]
            if "native_ruleset" in fixture
            else clean
        )
        case = {
            "id": fixture["id"],
            "files": {filename: source},
            "configs": [rules, parse_control],
            "exit_code": 3 if invalid else int(bool(findings)),
            "findings": findings,
            "scanned_paths": [filename],
        }
        if invalid:
            case.update(
                error_types=["Syntax error", "Lexical error", "PartialParsing"], error_file=filename
            )
        cases.append(case)
    return cases


def main() -> int:
    """Retain every case result and fail the build on any actual incompatibility."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scanner", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--python-fixtures", type=Path, required=True)
    parser.add_argument("--cli-fixtures", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    receipt: dict[str, Any] = {"status": "failed", "cases": []}
    try:
        fixtures = json.loads(args.python_fixtures.read_text())
        cases = python_cases(fixtures) + json.loads(args.cli_fixtures.read_text())["cases"]
        names = [case["id"] for case in cases]
        if not names or len(set(names)) != len(names):
            raise ValueError("Native scanner contracts must have unique nonempty scope")
        receipt["expected_cases"] = names
        for case in cases:
            try:
                receipt["cases"].append(run_case(args.scanner.resolve(), args.output, case))
            except (
                OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError,
            ) as error:
                receipt["cases"].append({
                    "id": case["id"], "status": "failed",
                    "error": f"{type(error).__name__}: {error}",
                })
        failed = any(case["status"] != "passed" for case in receipt["cases"])
        receipt["status"] = "failed" if failed else "passed"
        return int(failed)
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as error:
        receipt["error"] = f"{type(error).__name__}: {error}"
        return 1
    finally:
        (args.output / "summary.json").write_text(json.dumps(receipt, indent=2) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
