"""Require independently measured 95% line and branch coverage of numerical cores."""

from __future__ import annotations

import pathlib

# The parser below rejects DTD declarations and all entities before processing them.
# Tests exercise internal/external entity payloads; dependency-free tooling is intentional.
import xml.parsers.expat  # nosemgrep: python.lang.security.use-defused-xml.use-defused-xml
from typing import Any

from dependencies import table

THRESHOLD = 95
COUNT_FIELDS = (
    "num_statements",
    "covered_lines",
    "missing_lines",
    "num_branches",
    "covered_branches",
    "missing_branches",
)


def expected_sources(root: pathlib.Path, sources: list[str]) -> set[str]:
    """Resolve every declared core target to real Python files within the repository."""
    if not sources:
        raise ValueError("Numerical core source targets must be nonempty")
    root = root.resolve()
    expected: set[str] = set()
    for source in sources:
        target = root / source
        if target.is_symlink() or not target.resolve().is_relative_to(root):
            raise ValueError(f"Numerical core target leaves the repository: {source}")
        candidates = list(target.rglob("*.py")) if target.is_dir() else [target]
        files = [path for path in candidates if path.is_file() and path.suffix == ".py"]
        if not files:
            raise ValueError(f"Numerical core target contains no Python source: {source}")
        for path in files:
            if path.is_symlink() or not path.resolve().is_relative_to(root):
                raise ValueError(f"Numerical core source leaves the repository: {path}")
            expected.add(path.relative_to(root).as_posix())
    return expected


def counts(value: object, label: str) -> dict[str, int]:
    """Validate integer line and branch counts and both conservation identities."""
    source = table(value, label)
    result: dict[str, int] = {}
    for field in COUNT_FIELDS:
        count = source.get(field)
        if not isinstance(count, int) or isinstance(count, bool) or count < 0:
            raise ValueError(f"{label}.{field} must be a nonnegative integer")
        result[field] = count
    if result["covered_lines"] + result["missing_lines"] != result["num_statements"]:
        raise ValueError(f"{label} has inconsistent line counts")
    if result["covered_branches"] + result["missing_branches"] != result["num_branches"]:
        raise ValueError(f"{label} has inconsistent branch counts")
    return result


def inspect_core(report: dict[str, Any], expected: set[str]) -> dict[str, Any]:
    """Evaluate expected core files without diluting counts with tooling or tests."""
    if not expected:
        raise ValueError("Numerical core has no expected source files")
    if table(report.get("meta"), "coverage metadata").get("branch_coverage") is not True:
        raise ValueError("Numerical core requires an explicit branch-coverage measurement")
    files = table(report.get("files"), "coverage files")
    missing = sorted(expected.difference(files))
    if missing:
        raise ValueError(f"Coverage omitted expected numerical core files: {missing}")
    totals = dict.fromkeys(COUNT_FIELDS, 0)
    for name in sorted(expected):
        file_report = table(files[name], f"coverage file {name}")
        summary = counts(file_report.get("summary"), f"coverage summary {name}")
        for field in COUNT_FIELDS:
            totals[field] += summary[field]
    if totals["num_statements"] == 0 or totals["covered_lines"] == 0:
        raise ValueError("Numerical core contains no executed source statements")
    if totals["num_branches"] == 0:
        raise ValueError("Numerical core contains no measured branches")
    lines_pass = totals["covered_lines"] * 100 >= THRESHOLD * totals["num_statements"]
    branches_pass = totals["covered_branches"] * 100 >= THRESHOLD * totals["num_branches"]
    return {
        "status": "passed" if lines_pass and branches_pass else "failed",
        "threshold_percent": {"line": THRESHOLD, "branch": THRESHOLD},
        "source_files": sorted(expected),
        "source_file_count": len(expected),
        "counts": totals,
        "line_percent": 100 * totals["covered_lines"] / totals["num_statements"],
        "branch_percent": 100 * totals["covered_branches"] / totals["num_branches"],
        "line_passed": lines_pass,
        "branch_passed": branches_pass,
    }


def executed_cases(path: pathlib.Path) -> dict[str, int]:
    """Count real JUnit test cases, rejecting DTDs, entities and absent execution."""
    parser = xml.parsers.expat.ParserCreate()
    totals = {"total": 0, "skipped": 0, "executed": 0}
    current: list[bool] = []

    def reject_declaration(*_arguments: object) -> None:
        raise ValueError("JUnit reports must not contain DTD or entity declarations")

    def reject_external(*_arguments: object) -> int:
        raise ValueError("JUnit reports must not reference external entities")

    def start(name: str, _attributes: dict[str, str]) -> None:
        if name == "testcase":
            if current:
                raise ValueError("JUnit test cases must not be nested")
            current.append(False)
        elif name == "skipped" and current:
            current[-1] = True

    def end(name: str) -> None:
        if name == "testcase":
            if not current:
                raise ValueError("JUnit report has an unmatched test case")
            skipped = current.pop()
            totals["total"] += 1
            totals["skipped"] += int(skipped)
            totals["executed"] += int(not skipped)

    parser.StartDoctypeDeclHandler = reject_declaration
    parser.EntityDeclHandler = reject_declaration
    parser.ExternalEntityRefHandler = reject_external
    parser.StartElementHandler = start
    parser.EndElementHandler = end
    try:
        with path.open("rb") as source:
            parser.ParseFile(source)
    except xml.parsers.expat.ExpatError as error:
        raise ValueError(f"JUnit report is malformed: {error}") from error
    if totals["executed"] <= 0:
        raise ValueError("JUnit report contains no executed test cases")
    return totals
