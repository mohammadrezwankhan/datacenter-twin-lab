"""Validate scanner evidence independently of a process's exit status."""

from __future__ import annotations

from typing import Any


def object_value(value: Any, label: str) -> dict[str, Any]:
    """Require an object rather than treating absent evidence as an empty report."""
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def list_value(value: Any, label: str) -> list[Any]:
    """Require an explicitly present array, including valid empty finding arrays."""
    if not isinstance(value, list):
        raise ValueError(f"{label} must be an array")
    return value


def text_value(value: Any, label: str) -> str:
    """Require a nonempty scanner identity, package identity or target path."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be nonempty text")
    return value


def count_value(value: Any, label: str) -> int:
    """Reject booleans, negative numbers and fractional scanner counts."""
    if type(value) is not int or value < 0:
        raise ValueError(f"{label} must be a nonnegative integer")
    return value


def inspect_findings(report: Any, scanner: str) -> dict[str, int]:
    """Require explicit Zizmor/Gitleaks finding arrays and retain every finding."""
    findings = list_value(report, f"{scanner} findings")
    for finding in findings:
        entry = object_value(finding, f"{scanner} finding")
        if scanner == "gitleaks":
            text_value(entry.get("RuleID"), "Gitleaks rule")
            text_value(entry.get("File"), "Gitleaks file")
        elif not entry:
            raise ValueError("Zizmor finding must not be empty")
    return {"findings": len(findings), "blocking_findings": len(findings)}


def inspect_pip(report: Any) -> dict[str, int]:
    """Require actual audited packages and reject skipped or vulnerable packages."""
    data = object_value(report, "pip-audit report")
    dependencies = list_value(data.get("dependencies"), "pip-audit dependencies")
    list_value(data.get("fixes"), "pip-audit fixes")
    if not dependencies:
        raise ValueError("pip-audit audited no packages for a required manifest")
    if data.get("error") or data.get("errors") or data.get("skipped"):
        raise ValueError("pip-audit reported an error or omitted packages")
    findings = 0
    for dependency in dependencies:
        item = object_value(dependency, "pip-audit dependency")
        text_value(item.get("name"), "pip-audit package name")
        text_value(item.get("version"), "pip-audit package version")
        if item.get("skip_reason"):
            raise ValueError("pip-audit skipped a required dependency")
        vulnerabilities = list_value(item.get("vulns"), "pip-audit vulnerabilities")
        for vulnerability in vulnerabilities:
            finding = object_value(vulnerability, "pip-audit vulnerability")
            text_value(finding.get("id"), "pip-audit advisory identity")
        findings += len(vulnerabilities)
    return {
        "audited_packages": len(dependencies),
        "findings": findings,
        "blocking_findings": findings,
    }


def inspect_npm(report: Any) -> dict[str, int]:
    """Reconcile npm's findings with its totals and retain the HIGH/CRITICAL gate."""
    data = object_value(report, "npm audit report")
    if type(data.get("auditReportVersion")) is not int or data["auditReportVersion"] != 2:
        raise ValueError("npm audit report version must be 2")
    if data.get("error") or data.get("errors"):
        raise ValueError("npm audit reported a service or analysis error")
    vulnerabilities = object_value(data.get("vulnerabilities"), "npm vulnerabilities")
    metadata = object_value(data.get("metadata"), "npm metadata")
    totals = object_value(metadata.get("vulnerabilities"), "npm vulnerability totals")
    dependencies = object_value(metadata.get("dependencies"), "npm dependency totals")
    packages = count_value(dependencies.get("total"), "npm dependency count")
    if packages == 0:
        raise ValueError("npm audit analyzed no packages for a required lockfile")
    counts = dict.fromkeys(("info", "low", "moderate", "high", "critical"), 0)
    for name, vulnerability in vulnerabilities.items():
        item = object_value(vulnerability, "npm vulnerability")
        if text_value(item.get("name"), "npm package name") != name:
            raise ValueError("npm vulnerability key and package name disagree")
        severity = text_value(item.get("severity"), "npm severity")
        if severity not in counts:
            raise ValueError("npm vulnerability severity is unknown")
        counts[severity] += 1
    for severity, actual in counts.items():
        if count_value(totals.get(severity), f"npm {severity} total") != actual:
            raise ValueError(f"npm {severity} finding count disagrees with metadata")
    if count_value(totals.get("total"), "npm total") != len(vulnerabilities):
        raise ValueError("npm total finding count disagrees with metadata")
    return {
        "audited_packages": packages,
        "findings": len(vulnerabilities),
        "blocking_findings": counts["high"] + counts["critical"],
        **counts,
    }


def inspect_trivy(report: Any, expected: set[str]) -> dict[str, int]:
    """Require supported target evidence and count HIGH/CRITICAL findings."""
    data = object_value(report, "Trivy report")
    if type(data.get("SchemaVersion")) is not int or data["SchemaVersion"] != 2:
        raise ValueError("Trivy schema version must be 2")
    artifact_type = text_value(data.get("ArtifactType"), "Trivy artifact type")
    if artifact_type not in {"filesystem", "repository"}:
        raise ValueError("Trivy report must describe the requested filesystem scan")
    if data.get("Errors") or data.get("Error"):
        raise ValueError("Trivy reported an analysis error")
    results = list_value(data.get("Results"), "Trivy results")
    if not results:
        raise ValueError("Trivy analyzed no supported targets")
    targets: set[str] = set()
    findings = 0
    blocking = 0
    for result in results:
        item = object_value(result, "Trivy target")
        targets.add(text_value(item.get("Target"), "Trivy target path"))
        text_value(item.get("Class"), "Trivy target class")
        text_value(item.get("Type"), "Trivy target type")
        if item.get("Errors") or item.get("Error"):
            raise ValueError("Trivy reported a target analysis error")
        for field in ("Vulnerabilities", "Misconfigurations"):
            for vulnerability in list_value(item.get(field, []), f"Trivy {field}"):
                finding = object_value(vulnerability, "Trivy finding")
                severity = text_value(finding.get("Severity"), "Trivy severity")
                if severity not in {"UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"}:
                    raise ValueError("Trivy finding severity is unknown")
                findings += 1
                blocking += severity in {"HIGH", "CRITICAL"}
    missing = expected - targets
    if missing:
        raise ValueError(f"Trivy omitted required lockfile targets: {sorted(missing)}")
    return {
        "analyzed_targets": len(targets),
        "required_lockfile_targets": len(expected),
        "findings": findings,
        "blocking_findings": blocking,
    }
