"""Exercise security gate rejection paths and successful analysis contracts."""

from __future__ import annotations

import hashlib
import io
import json
import os
import pathlib
import subprocess
import tarfile
import tempfile
import unittest
from typing import Any
from unittest import mock

import bootstrap
import check_sarif
import coverage_gate
import dependencies
import report_validation
import run as gate_runner


def sarif_report(severity: str = "4.0", *, extension: bool = False) -> dict[str, Any]:
    """Build a valid successful analysis with an optional extension rule."""
    rule = {"id": "test/security", "properties": {"security-severity": severity}}
    driver: dict[str, Any] = {"name": "CodeQL", "rules": [] if extension else [rule]}
    result: dict[str, Any] = {
        "ruleId": "test/security",
        "level": "warning",
        "message": {"text": "Synthetic policy finding"},
    }
    tool: dict[str, Any] = {"driver": driver}
    if extension:
        tool["extensions"] = [{"name": "query-pack", "rules": [rule]}]
        result["rule"] = {"index": 0, "toolComponent": {"index": 0}}
    return {
        "version": "2.1.0",
        "runs": [
            {
                "tool": tool,
                "invocations": [{"executionSuccessful": True}],
                "results": [result],
            }
        ],
    }


class SarifContractTests(unittest.TestCase):
    """Reject incomplete or malformed analysis and resolve extension severity."""

    def test_completed_empty_analysis_is_accepted(self) -> None:
        """Allow a real completed run with no findings."""
        report = sarif_report()
        report["runs"][0]["results"] = []
        self.assertEqual(check_sarif.inspect_report(report), (0, 0))

    def test_driver_and_extension_high_severity_are_blocking(self) -> None:
        """Treat high severity identically in driver and extension rule tables."""
        for extension in (False, True):
            with self.subTest(extension=extension):
                self.assertEqual(
                    check_sarif.inspect_report(sarif_report("9.8", extension=extension)),
                    (1, 1),
                )

    def test_extension_can_resolve_by_name(self) -> None:
        """Resolve a named extension when a component index is absent."""
        report = sarif_report("9.8", extension=True)
        report["runs"][0]["results"][0]["rule"] = {
            "id": "test/security",
            "toolComponent": {"name": "query-pack"},
        }
        self.assertEqual(check_sarif.inspect_report(report), (1, 1))

    def test_nonfinite_or_out_of_range_severity_is_rejected(self) -> None:
        """Fail on severity values that could bypass a numeric comparison."""
        for severity in ("NaN", "Infinity", "-Infinity", "-1", "10.1", "invalid"):
            with self.subTest(severity=severity), self.assertRaises(ValueError):
                check_sarif.inspect_report(sarif_report(severity))

    def test_missing_analysis_structure_is_rejected(self) -> None:
        """Require tool identity, results and successful invocation evidence."""
        malformed: list[dict[str, Any]] = [
            {"version": "2.1.0", "runs": [{}]},
            {"version": "2.1.0", "runs": []},
            {"runs": []},
        ]
        for field in ("tool", "results", "invocations"):
            candidate = sarif_report()
            del candidate["runs"][0][field]
            malformed.append(candidate)
        for report in malformed:
            with self.subTest(report=report), self.assertRaises(ValueError):
                check_sarif.inspect_report(report)

    def test_failed_analyzer_is_rejected(self) -> None:
        """Never accept successful-looking findings after an analyzer failure."""
        report = sarif_report()
        report["runs"][0]["invocations"][0]["executionSuccessful"] = False
        with self.assertRaises(ValueError):
            check_sarif.inspect_report(report)

    def test_unknown_or_conflicting_rule_reference_is_rejected(self) -> None:
        """Require a unique rule and consistent rule ID/index metadata."""
        for reference in ({"index": 7}, {"index": 0, "id": "other/rule"}):
            report = sarif_report()
            report["runs"][0]["results"][0]["rule"] = reference
            with self.subTest(reference=reference), self.assertRaises(ValueError):
                check_sarif.inspect_report(report)

    def test_invalid_extension_reference_is_rejected(self) -> None:
        """Reject negative, boolean and nonexistent tool component indices."""
        for index in (-1, True, 4):
            report = sarif_report(extension=True)
            report["runs"][0]["results"][0]["rule"]["toolComponent"]["index"] = index
            with self.subTest(index=index), self.assertRaises(ValueError):
                check_sarif.inspect_report(report)

    def test_duplicate_unqualified_rule_is_rejected(self) -> None:
        """Reject ambiguity instead of choosing a lower severity driver rule."""
        report = sarif_report()
        report["runs"][0]["tool"]["extensions"] = [
            {
                "name": "query-pack",
                "rules": [{"id": "test/security", "properties": {"security-severity": "9.8"}}],
            }
        ]
        with self.assertRaises(ValueError):
            check_sarif.inspect_report(report)

    def test_error_level_blocks_without_numeric_severity(self) -> None:
        """Preserve errors from rules that do not use CVSS metadata."""
        report = sarif_report("0")
        report["runs"][0]["results"][0]["level"] = "error"
        self.assertEqual(check_sarif.inspect_report(report), (1, 1))

    def test_missing_report_writes_failed_receipt(self) -> None:
        """Make absent CodeQL output observable as a failed gate."""
        with tempfile.TemporaryDirectory() as directory:
            with mock.patch("sys.argv", ["check_sarif.py", directory]):
                self.assertEqual(check_sarif.main(), 2)
            receipt = json.loads((pathlib.Path(directory) / "quality-gate.json").read_text())
            self.assertEqual(receipt["status"], "failed")
            self.assertEqual(receipt["reports"], 0)


class SastCompletenessTests(unittest.TestCase):
    """Reject nominally successful but missing or partial Semgrep analysis."""

    def test_complete_report_records_scope_and_raw_findings(self) -> None:
        """Retain matching findings while checking every expected source target."""
        report = {
            "errors": [],
            "results": [{"check_id": "test"}],
            "paths": {"scanned": ["core.py", "view.tsx"]},
        }
        result = gate_runner.inspect_semgrep(report, {"core.py", "view.tsx"})
        self.assertEqual(result["findings"], 1)
        self.assertEqual(result["expected_source_targets"], 2)

    def test_errors_empty_targets_and_omitted_sources_fail(self) -> None:
        """Do not clear a scanner after parsing errors or skipped authored code."""
        cases: list[dict[str, Any]] = [
            {"errors": [], "results": [], "paths": {"scanned": []}},
            {
                "errors": [{"type": "PartialParsing"}],
                "results": [],
                "paths": {"scanned": ["core.py"]},
            },
            {"errors": [], "results": [], "paths": {"scanned": ["other.py"]}},
            {"results": [], "paths": {"scanned": ["core.py"]}},
            {"errors": [], "paths": {"scanned": ["core.py"]}},
        ]
        for report in cases:
            with self.subTest(report=report), self.assertRaises(ValueError):
                gate_runner.inspect_semgrep(report, {"core.py"})


class DependencyContractTests(unittest.TestCase):
    """Cover static declaration discovery and PEP 735 edge cases."""

    def test_tool_only_project_retains_development_dependencies(self) -> None:
        """Audit development groups even when no installable project exists."""
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "pyproject.toml"
            path.write_text(
                '[tool.ruff]\nline-length = 100\n[dependency-groups]\ndev = ["ruff==0.17.3"]\n'
            )
            manifests = dependencies.manifests_for(path)
            self.assertEqual(
                [(item.kind, item.requirements) for item in manifests],
                [("group-dev", ("ruff==0.17.3",))],
            )

    def test_project_extras_include_runtime_and_build_is_separate(self) -> None:
        """Retain the base requirement when resolving an optional feature."""
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "pyproject.toml"
            path.write_text(
                '[project]\nname="example"\ndependencies=["core==1"]\n'
                '[project.optional-dependencies]\ntest=["test-lib==2"]\n'
                '[build-system]\nrequires=["builder==3"]\n'
            )
            result = {item.kind: item.requirements for item in dependencies.manifests_for(path)}
            self.assertEqual(result["runtime"], ("core==1",))
            self.assertEqual(result["extra-test"], ("core==1", "test-lib==2"))
            self.assertEqual(result["build"], ("builder==3",))

    def test_included_groups_normalize_names(self) -> None:
        """Resolve PEP 735 normalized group references without dropping entries."""
        groups = {
            "Core_Tools": ["ruff==0.17.3"],
            "dev": [{"include-group": "core.tools"}],
        }
        self.assertEqual(dependencies.expand_group(groups, "dev"), ["ruff==0.17.3"])

    def test_cycles_ambiguous_names_and_invalid_groups_fail(self) -> None:
        """Prevent partial audits when dependency declarations are malformed."""
        cases: list[dict[str, Any]] = [
            {"dev": [{"include-group": "dev"}]},
            {"dev": [{"include-group": "missing"}]},
            {"dev": [17]},
            {"dev": "ruff"},
            {"dev": [{"include-group": "a-b"}], "a-b": [], "A_B": []},
        ]
        for groups in cases:
            with self.subTest(groups=groups), self.assertRaises(ValueError):
                dependencies.expand_group(groups, "dev")

    def test_dynamic_dependencies_fail_closed(self) -> None:
        """Do not claim coverage for declarations requiring project execution."""
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "pyproject.toml"
            path.write_text('[project]\nname="example"\ndynamic=["dependencies"]\n')
            with self.assertRaises(ValueError):
                dependencies.manifests_for(path)

    def test_editable_manifest_expands_static_runtime_and_requested_extras(self) -> None:
        """Audit local dependencies instead of querying an unpublished project name."""
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / "pyproject.toml").write_text(
                '[project]\nname="unpublished"\ndependencies=["core==1"]\n'
                '[project.optional-dependencies]\ndev=["test-lib==2"]\n'
            )
            path = root / "requirements.txt"
            path.write_text("# project install\n-e .[dev]\nother==3\n")
            self.assertEqual(
                dependencies.expand_local_editable(path),
                ("core==1", "test-lib==2", "other==3"),
            )

    def test_editable_manifest_rejects_uncovered_or_dynamic_targets(self) -> None:
        """Reject paths, URLs, missing extras and mixed include directives."""
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            project = root / "pyproject.toml"
            project.write_text('[project]\nname="example"\ndependencies=["core==1"]\n')
            path = root / "requirements.txt"
            for content in (
                "-e ../other\n",
                "-e https://example.invalid/project\n",
                "-e .[missing]\n",
                "-e .\n-r another.txt\n",
            ):
                with self.subTest(content=content), self.assertRaises(ValueError):
                    path.write_text(content)
                    dependencies.expand_local_editable(path)
            path.write_text("-e .\n")
            project.write_text('[project]\nname="example"\ndynamic=["dependencies"]\n')
            with self.assertRaises(ValueError):
                dependencies.expand_local_editable(path)

    def test_ordinary_requirements_keep_native_audit_handling(self) -> None:
        """Preserve hash-locked requirements without rewriting their syntax."""
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "requirements.txt"
            path.write_text("core==1 --hash=sha256:abc\n")
            self.assertIsNone(dependencies.expand_local_editable(path))


def scanner_archive(*, symbolic: bool = False) -> bytes:
    """Construct a release fixture with an unrelated traversal entry."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        payload = b"fixture executable bytes"
        member = tarfile.TarInfo("scanner")
        if symbolic:
            member.type = tarfile.SYMTYPE
            member.linkname = "../outside"
            archive.addfile(member)
        else:
            member.size = len(payload)
            archive.addfile(member, io.BytesIO(payload))
        outside = tarfile.TarInfo("../outside")
        outside.size = len(payload)
        archive.addfile(outside, io.BytesIO(payload))
    return buffer.getvalue()


class BootstrapContractTests(unittest.TestCase):
    """Authenticate release bytes and avoid unsafe archive extraction."""

    def test_verified_archive_extracts_only_regular_expected_binary(self) -> None:
        """Ignore traversal entries rather than extracting a complete archive."""
        blob = scanner_archive()
        spec = {
            "url": "https://example.invalid/scanner.tar.gz",
            "version": "test",
            "sha256": hashlib.sha256(blob).hexdigest(),
        }
        with tempfile.TemporaryDirectory() as directory:
            destination = pathlib.Path(directory) / "bin"
            destination.mkdir()
            with mock.patch("urllib.request.urlopen", return_value=io.BytesIO(blob)):
                bootstrap.install_binary("scanner", spec, destination)
            self.assertTrue((destination / "scanner").is_file())
            self.assertFalse((pathlib.Path(directory) / "outside").exists())

    def test_digest_mismatch_refuses_installation(self) -> None:
        """Reject tampered release bytes before writing an executable."""
        blob = scanner_archive()
        spec = {
            "url": "https://example.invalid/scanner.tar.gz",
            "version": "test",
            "sha256": "0" * 64,
        }
        with tempfile.TemporaryDirectory() as directory:
            with (
                mock.patch("urllib.request.urlopen", return_value=io.BytesIO(blob)),
                self.assertRaises(RuntimeError),
            ):
                bootstrap.install_binary("scanner", spec, pathlib.Path(directory))
            self.assertFalse((pathlib.Path(directory) / "scanner").exists())

    def test_symbolic_executable_is_rejected(self) -> None:
        """Do not install links even from a digest-matching archive."""
        blob = scanner_archive(symbolic=True)
        spec = {
            "url": "https://example.invalid/scanner.tar.gz",
            "version": "test",
            "sha256": hashlib.sha256(blob).hexdigest(),
        }
        with (
            tempfile.TemporaryDirectory() as directory,
            mock.patch("urllib.request.urlopen", return_value=io.BytesIO(blob)),
            self.assertRaises(RuntimeError),
        ):
            bootstrap.install_binary("scanner", spec, pathlib.Path(directory))

    def test_non_https_release_is_rejected_without_network(self) -> None:
        """Require the declared transport policy before contacting a host."""
        with (
            tempfile.TemporaryDirectory() as directory,
            mock.patch("urllib.request.urlopen") as download,
        ):
            with self.assertRaises(ValueError):
                bootstrap.install_binary(
                    "scanner",
                    {"url": "http://example.invalid/file"},
                    pathlib.Path(directory),
                )
            download.assert_not_called()

    def test_missing_scanner_records_failed_command(self) -> None:
        """Keep tool absence distinct from an empty successful scan."""
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            with mock.patch.object(gate_runner, "ROOT", root):
                gate = gate_runner.Gate("missing-scanner", root)
                gate.run("unavailable", [str(root / "not-installed")], cwd=root)
            self.assertEqual(gate.checks[0]["status"], "failed")
            self.assertNotEqual(gate.checks[0]["exit_code"], 0)


def coverage_report(*, covered_lines: int = 96, covered_branches: int = 96) -> dict[str, Any]:
    """Construct a branch-enabled report with independent line and branch totals."""
    summary = {
        "num_statements": 100,
        "covered_lines": covered_lines,
        "missing_lines": 100 - covered_lines,
        "num_branches": 100,
        "covered_branches": covered_branches,
        "missing_branches": 100 - covered_branches,
    }
    return {
        "meta": {"branch_coverage": True},
        "totals": dict(summary),
        "files": {"core.py": {"summary": dict(summary)}},
    }


class CoverageContractTests(unittest.TestCase):
    """Enforce separate numerical core thresholds without tool/test dilution."""

    def test_both_thresholds_must_pass_independently(self) -> None:
        """Reject deficient lines or branches even when the other metric passes."""
        for lines, branches, status in (
            (96, 96, "passed"),
            (94, 100, "failed"),
            (100, 94, "failed"),
            (95, 95, "passed"),
        ):
            with self.subTest(lines=lines, branches=branches):
                result = coverage_gate.inspect_core(
                    coverage_report(covered_lines=lines, covered_branches=branches),
                    {"core.py"},
                )
                self.assertEqual(result["status"], status)

    def test_missing_branch_measurement_is_rejected(self) -> None:
        """Do not reinterpret absent branch data as full coverage."""
        for field in (
            "branch_coverage",
            "num_branches",
            "covered_branches",
            "missing_branches",
        ):
            report = coverage_report()
            if field == "branch_coverage":
                del report["meta"][field]
            else:
                del report["files"]["core.py"]["summary"][field]
            with self.subTest(field=field), self.assertRaises(ValueError):
                coverage_gate.inspect_core(report, {"core.py"})

    def test_nonempty_test_tools_do_not_hide_unexecuted_core(self) -> None:
        """Reject an unexecuted core even when other files inflate global totals."""
        report = coverage_report(covered_lines=0)
        report["totals"]["covered_lines"] = 10000
        with self.assertRaises(ValueError):
            coverage_gate.inspect_core(report, {"core.py"})

    def test_missing_expected_source_is_rejected(self) -> None:
        """Reject an empty expected core and any silently omitted source file."""
        for expected in (set(), {"core.py", "omitted.py"}):
            with self.subTest(expected=expected), self.assertRaises(ValueError):
                coverage_gate.inspect_core(coverage_report(), expected)

    def test_invalid_or_inconsistent_counts_are_rejected(self) -> None:
        """Reject malformed totals rather than accepting a misleading ratio."""
        for value in (True, -1, "100", 0.5, float("nan"), 101):
            report = coverage_report()
            report["files"]["core.py"]["summary"]["covered_branches"] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                coverage_gate.inspect_core(report, {"core.py"})

    def test_source_resolution_rejects_empty_and_external_targets(self) -> None:
        """Require real source files within the repository for every core target."""
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / "empty").mkdir()
            (root / "core.py").write_text("value = 1\n")
            self.assertEqual(coverage_gate.expected_sources(root, ["core.py"]), {"core.py"})
            for sources in ([], ["missing"], ["empty"], ["../outside.py"]):
                with self.subTest(sources=sources), self.assertRaises(ValueError):
                    coverage_gate.expected_sources(root, sources)

    def test_test_case_evidence_requires_execution(self) -> None:
        """Reject empty, entirely skipped, and entity-bearing test reports."""
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "junit.xml"
            for content in (
                '<testsuites><testsuite tests="100"/></testsuites>',
                "<testsuites><testsuite><testcase><skipped/></testcase></testsuite></testsuites>",
                '<!DOCTYPE testsuites [<!ENTITY value "x">]><testsuites/>',
            ):
                path.write_text(content)
                with self.subTest(content=content), self.assertRaises(ValueError):
                    coverage_gate.executed_cases(path)
            path.write_text(
                "<testsuites><testsuite><testcase/><testcase><skipped/></testcase></testsuite></testsuites>"
            )
            self.assertEqual(
                coverage_gate.executed_cases(path),
                {"total": 2, "skipped": 1, "executed": 1},
            )

    def test_branchless_core_is_rejected_as_misconfigured(self) -> None:
        """Require an actual branch denominator for a numerical branch gate."""
        report = coverage_report()
        report["files"]["core.py"]["summary"].update(
            {"num_branches": 0, "covered_branches": 0, "missing_branches": 0}
        )
        with self.assertRaises(ValueError):
            coverage_gate.inspect_core(report, {"core.py"})


class ScannerEvidenceTests(unittest.TestCase):
    """Discriminate successful processes from complete, current scanner evidence."""

    def test_missing_report_cannot_pass_any_scanner_mode(self) -> None:
        """Reproduce zero-exit processes that emit no report for every mode."""
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / ".github/workflows").mkdir(parents=True)
            (root / ".github/workflows/fixture.yml").write_text("name: test\n")
            source = root / "core.py"
            source.write_text("value = 1\n")
            requirements = root / "requirements.txt"
            requirements.write_text("example==1\n")
            with (
                mock.patch.object(gate_runner, "ROOT", root),
                mock.patch.object(gate_runner.Gate.run, "__defaults__", (root,)),
                mock.patch.object(
                    gate_runner, "source_files", return_value=[source, requirements],
                ),
                mock.patch.object(subprocess, "check_output", return_value="a" * 40),
                mock.patch.object(
                    subprocess, "run",
                    return_value=subprocess.CompletedProcess([], 0, "", ""),
                ),
            ):
                for mode in ("workflow", "secrets", "dependencies", "trivy", "sast"):
                    with self.subTest(mode=mode):
                        gate = gate_runner.Gate(mode, root / "tools")
                        self.assertEqual(gate.execute(), 1)
                        receipt = json.loads((gate.out / "summary.json").read_text())
                        self.assertEqual(receipt["status"], "failed")

    def test_prior_clean_report_is_never_reused(self) -> None:
        """Keep prior evidence while rejecting a later scan that produces nothing."""
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            with mock.patch.object(gate_runner, "ROOT", root):
                first = gate_runner.Gate("secrets", root)
                (first.out / "gitleaks-history.json").write_text("[]")
                second = gate_runner.Gate("secrets", root)
                second.inspect_report("gitleaks-history", "gitleaks")
                self.assertNotEqual(first.out, second.out)
                self.assertEqual(second.checks[-1]["status"], "failed")
                self.assertEqual((first.out / "gitleaks-history.json").read_text(), "[]")

    def test_quality_source_binding_detects_changes_and_new_files(self) -> None:
        """An otherwise passing command cannot certify bytes edited during validation."""
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            source = root / "core.py"
            source.write_text("value = 1\n")
            with (
                mock.patch.object(gate_runner, "ROOT", root),
                mock.patch.object(gate_runner, "source_files", return_value=[source]),
            ):
                gate = gate_runner.Gate("python-tests", root)
                gate.bind_sources()
                gate.verify_sources()
                source.write_text("value = 2\n")
                with self.assertRaises(RuntimeError):
                    gate.verify_sources()
                self.assertEqual(gate.coverage["source_changed_during_scan"], ["core.py"])

    def test_pip_resolver_includes_preinstalled_build_packages(self) -> None:
        """Scope pip's supported resolution flag to the child scanner process."""
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            requirement = root / "requirements.txt"
            requirement.write_text("setuptools==84.2.1\nwheel\n")
            with (
                mock.patch.object(gate_runner, "ROOT", root),
                mock.patch.dict(os.environ, {"PIP_IGNORE_INSTALLED": "0"}),
                mock.patch.object(subprocess, "run", return_value=
                                  subprocess.CompletedProcess([], 0, "", "")) as process,
            ):
                gate = gate_runner.Gate("dependencies", root)
                gate.dependencies([requirement])
                self.assertEqual(process.call_args.kwargs["env"]["PIP_IGNORE_INSTALLED"], "1")
                self.assertEqual(os.environ["PIP_IGNORE_INSTALLED"], "0")
                self.assertEqual(gate.checks[-1]["status"], "failed")

    def test_empty_finding_arrays_are_valid_but_missing_or_malformed_are_not(self) -> None:
        """Accept actual clean findings without converting absent output into clean."""
        malformed: list[Any] = [None, {}, "[]", [None], [{}]]
        for scanner in ("zizmor", "gitleaks"):
            self.assertEqual(report_validation.inspect_findings([], scanner)["findings"], 0)
            for report in malformed:
                with (
                    self.subTest(scanner=scanner, report=report), self.assertRaises(ValueError),
                ):
                    report_validation.inspect_findings(report, scanner)

    def test_pip_rejects_empty_build_audits_and_skipped_dependencies(self) -> None:
        """Cover the actual empty build-manifest reports found in the v2 evidence."""
        cases: list[dict[str, Any]] = [
            {"dependencies": [], "fixes": []},
            {"dependencies": [{"name": "setuptools", "skip_reason": "not audited"}],
             "fixes": []},
            {"dependencies": [{"name": "setuptools", "version": "84.2.1"}], "fixes": []},
        ]
        for report in cases:
            with self.subTest(report=report), self.assertRaises(ValueError):
                report_validation.inspect_pip(report)
        clean = {"dependencies": [{"name": "setuptools", "version": "84.2.1", "vulns": []}],
                 "fixes": []}
        self.assertEqual(report_validation.inspect_pip(clean)["audited_packages"], 1)

    def test_findings_block_even_when_process_exit_is_zero(self) -> None:
        """Independent report policy catches a contradictory success exit status."""
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            with mock.patch.object(gate_runner, "ROOT", root):
                gate = gate_runner.Gate("dependencies", root)
                report = {"dependencies": [
                    {"name": "example", "version": "1", "vulns": [{"id": "TEST-1"}]}],
                    "fixes": []}
                (gate.out / "audit.json").write_text(json.dumps(report))
                gate.checks.append({"name": "audit", "exit_code": 0, "status": "passed"})
                gate.inspect_report("audit", "pip-audit")
                self.assertEqual(gate.checks[-1]["exit_code"], 1)
                self.assertEqual(gate.coverage["report_validation"]["audit"]["findings"], 1)

    def test_npm_reconciles_counts_and_preserves_severity_threshold(self) -> None:
        """Retain moderate findings and reject inconsistent, boolean or missing totals."""
        report: dict[str, Any] = {
            "auditReportVersion": 2,
            "vulnerabilities": {"example": {"name": "example", "severity": "moderate"}},
            "metadata": {"dependencies": {"total": 1}, "vulnerabilities": {
                "info": 0, "low": 0, "moderate": 1, "high": 0, "critical": 0, "total": 1}},
        }
        result = report_validation.inspect_npm(report)
        self.assertEqual(result["findings"], 1)
        self.assertEqual(result["blocking_findings"], 0)
        for count in (True, -1, 0, "1", 1.0):
            report["metadata"]["vulnerabilities"]["moderate"] = count
            with self.subTest(count=count), self.assertRaises(ValueError):
                report_validation.inspect_npm(report)
        report["metadata"]["vulnerabilities"].update(moderate=0, high=1)
        report["vulnerabilities"]["example"]["severity"] = "high"
        self.assertEqual(report_validation.inspect_npm(report)["blocking_findings"], 1)

    def test_trivy_accepts_git_checkout_reports_and_rejects_other_artifacts(self) -> None:
        """Trivy classifies a clean Git checkout as a repository during fs scans."""
        report: dict[str, Any] = {
            "SchemaVersion": 2,
            "ArtifactType": "repository",
            "Results": [{"Target": "package-lock.json", "Class": "lang-pkgs", "Type": "npm"}],
        }
        self.assertEqual(
            report_validation.inspect_trivy(report, {"package-lock.json"})["analyzed_targets"],
            1,
        )
        artifacts: tuple[object, ...] = (None, "", "container_image", "vm", True, [], {})
        for artifact in artifacts:
            report["ArtifactType"] = artifact
            with self.subTest(artifact=artifact), self.assertRaises(ValueError):
                report_validation.inspect_trivy(report, {"package-lock.json"})

    def test_trivy_requires_analyzed_targets_and_detects_high_findings(self) -> None:
        """Absent finding fields are valid only with complete supported-target evidence."""
        report: dict[str, Any] = {"SchemaVersion": 2, "ArtifactType": "filesystem", "Results": [
            {"Target": "package-lock.json", "Class": "lang-pkgs", "Type": "npm"}]}
        self.assertEqual(
            report_validation.inspect_trivy(report, {"package-lock.json"})["findings"], 0,
        )
        with self.assertRaises(ValueError):
            report_validation.inspect_trivy(
                report, {"package-lock.json", "other/package-lock.json"},
            )
        report["Results"][0]["Vulnerabilities"] = [{"Severity": "HIGH"}]
        self.assertEqual(report_validation.inspect_trivy(report, set())["blocking_findings"], 1)
        report["Results"] = []
        with self.assertRaises(ValueError):
            report_validation.inspect_trivy(report, set())


if __name__ == "__main__":
    unittest.main()
