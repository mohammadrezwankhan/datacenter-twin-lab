#!/usr/bin/env python3
"""Validate CodeQL SARIF and fail closed on errors or severe security findings."""

from __future__ import annotations

import argparse
import json
import logging
import math
import pathlib
from typing import Any

LOGGER = logging.getLogger(__name__)
LEVELS = {"none", "note", "warning", "error"}


def object_value(value: object, label: str) -> dict[str, Any]:
    """Require an object before interpreting an analysis record."""
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        raise ValueError(f"{label} must be an object")
    return dict(value)


def object_list(value: object, label: str) -> list[dict[str, Any]]:
    """Require an array of objects without silently dropping malformed entries."""
    if not isinstance(value, list):
        raise ValueError(f"{label} must be an array")
    return [object_value(item, label) for item in value]


def severity_value(rule: dict[str, Any]) -> float:
    """Reject invalid and non-finite CVSS values instead of treating them as low."""
    properties = object_value(rule.get("properties", {}), "rule properties")
    value = properties.get("security-severity", 0)
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError("Security severity must be a finite number from 0 to 10")
    severity = float(value)
    if not math.isfinite(severity) or not 0 <= severity <= 10:
        raise ValueError("Security severity must be a finite number from 0 to 10")
    return severity


def component_rules(component: dict[str, Any]) -> list[dict[str, Any]]:
    """Validate one named driver or extension and all of its rule metadata."""
    if not isinstance(component.get("name"), str) or not component["name"]:
        raise ValueError("SARIF tool components must have a nonempty name")
    rules = object_list(component.get("rules", []), "component rules")
    identities: set[str] = set()
    for rule in rules:
        identity = rule.get("id")
        if not isinstance(identity, str) or not identity or identity in identities:
            raise ValueError("Rule IDs must be nonempty and unique within a component")
        identities.add(identity)
        severity_value(rule)
        default = object_value(rule.get("defaultConfiguration", {}), "rule defaults")
        if default.get("level", "warning") not in LEVELS:
            raise ValueError("Invalid default SARIF result level")
    return rules


def resolve_rule(
    result: dict[str, Any],
    driver: list[dict[str, Any]],
    extensions: list[tuple[dict[str, Any], list[dict[str, Any]]]],
) -> dict[str, Any]:
    """Resolve rule references in both the driver and extension tool components."""
    reference = object_value(result.get("rule", {}), "result rule reference")
    component_ref = object_value(reference.get("toolComponent", {}), "tool component")
    candidates = driver
    if component_ref:
        index = component_ref.get("index")
        matches = list(range(len(extensions)))
        if index is not None:
            if type(index) is not int or not 0 <= index < len(extensions):
                raise ValueError("Invalid SARIF extension index")
            matches = [index]
        for key in ("name", "guid"):
            if key in component_ref:
                matches = [
                    item
                    for item in matches
                    if extensions[item][0].get(key) == component_ref[key]
                ]
        if len(matches) != 1:
            raise ValueError("Unknown or ambiguous SARIF extension reference")
        candidates = extensions[matches[0]][1]
    identity = reference.get("id", result.get("ruleId"))
    if (
        reference.get("id") is not None
        and result.get("ruleId") is not None
        and reference["id"] != result["ruleId"]
    ):
        raise ValueError("Conflicting SARIF rule identifiers")
    index = reference.get("index", result.get("ruleIndex"))
    if index is not None:
        if type(index) is not int or not 0 <= index < len(candidates):
            raise ValueError("Invalid SARIF rule index")
        rule = candidates[index]
        if identity is not None and rule["id"] != identity:
            raise ValueError("SARIF rule ID and index disagree")
        return rule
    if not isinstance(identity, str) or not identity:
        raise ValueError("A SARIF result must identify its rule")
    if not component_ref:
        candidates = [*driver, *(rule for _, rules in extensions for rule in rules)]
    matching = [rule for rule in candidates if rule["id"] == identity]
    if len(matching) != 1:
        raise ValueError("Unknown or ambiguous SARIF result rule")
    return matching[0]


def inspect_report(report: dict[str, Any]) -> tuple[int, int]:
    """Count findings only after confirming structurally valid, successful analysis."""
    if report.get("version") != "2.1.0":
        raise ValueError("Expected SARIF 2.1.0")
    runs = object_list(report.get("runs"), "analysis runs")
    if not runs:
        raise ValueError("Expected at least one analysis run")
    total, blocking = 0, 0
    for run in runs:
        tool = object_value(run.get("tool"), "analysis tool")
        driver = component_rules(object_value(tool.get("driver"), "analysis driver"))
        extensions = [
            (component, component_rules(component))
            for component in object_list(tool.get("extensions", []), "extensions")
        ]
        invocations = object_list(run.get("invocations"), "analyzer invocations")
        if not invocations:
            raise ValueError("Analyzer invocation evidence is missing")
        for invocation in invocations:
            if invocation.get("executionSuccessful") is not True:
                raise ValueError("Analyzer invocation did not complete successfully")
            notifications = object_list(
                invocation.get("toolExecutionNotifications", []), "notifications"
            )
            if any(item.get("level") == "error" for item in notifications):
                raise ValueError("SARIF records an analyzer error")
        results = object_list(run.get("results"), "analysis results")
        for result in results:
            message = object_value(result.get("message"), "result message")
            if not any(
                isinstance(message.get(key), str) for key in ("text", "markdown", "id")
            ):
                raise ValueError("SARIF result message is missing")
            rule = resolve_rule(result, driver, extensions)
            default = object_value(
                rule.get("defaultConfiguration", {}), "rule defaults"
            )
            level = result.get("level", default.get("level", "warning"))
            if level not in LEVELS:
                raise ValueError("Invalid SARIF result level")
            total += 1
            if severity_value(rule) >= 7 or level == "error":
                blocking += 1
    return total, blocking


def main() -> int:
    """Write a receipt even when CodeQL produces no usable analysis report."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=pathlib.Path)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    args.directory.mkdir(parents=True, exist_ok=True)
    counts: dict[str, Any] = {
        "reports": 0,
        "findings": 0,
        "blocking_findings": 0,
        "status": "failed",
    }
    try:
        files = sorted(args.directory.glob("*.sarif"))
        if not files:
            raise ValueError("CodeQL produced no SARIF report")
        counts["reports"] = len(files)
        for path in files:
            total, blocking = inspect_report(
                object_value(json.loads(path.read_text()), "SARIF document")
            )
            counts["findings"] += total
            counts["blocking_findings"] += blocking
        if counts["blocking_findings"]:
            return 1
        counts["status"] = "passed"
        return 0
    except (OSError, ValueError, KeyError, TypeError, OverflowError) as error:
        counts["error"] = f"{type(error).__name__}: {error}"
        LOGGER.error("CodeQL report validation failed: %s", error)
        return 2
    finally:
        (args.directory / "quality-gate.json").write_text(
            json.dumps(counts, indent=2) + "\n"
        )
        LOGGER.info("CodeQL SARIF gate: %s", counts)


if __name__ == "__main__":
    raise SystemExit(main())
