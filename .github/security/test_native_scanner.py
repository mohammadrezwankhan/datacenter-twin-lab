"""Reject incomplete native scanner audits and untrusted cached build inputs."""

from __future__ import annotations

import hashlib
import io
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import patch

import native_scanner
import scanner_contracts


def archive_bytes(name: str, *, link: str | None = None) -> bytes:
    """Create one controlled source member for the extraction boundary."""
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode="w:gz") as archive:
        member = tarfile.TarInfo(name)
        if link is not None:
            member.type = tarfile.SYMTYPE
            member.linkname = link
            archive.addfile(member)
        else:
            content = b"source\n"
            member.size = len(content)
            archive.addfile(member, io.BytesIO(content))
    return stream.getvalue()


class SourceIntegrityTests(unittest.TestCase):
    """No downloaded bytes may escape their verified source directory."""

    def test_tampered_source_is_rejected(self) -> None:
        """Changing downloaded bytes must fail before extraction or execution."""
        with self.assertRaises(RuntimeError):
            native_scanner.verify_blob(b"tampered", "0" * 64)

    def test_matching_source_digest_is_accepted(self) -> None:
        """The published digest permits the exact corresponding source bytes."""
        native_scanner.verify_blob(
            b"source\n",
            "b8bb034f9b63bd0254fbc7c157cae746c75853f4643d6cea844dc48ddb57f522",
        )

    def test_source_root_is_removed_without_losing_files(self) -> None:
        """A Git source archive installs its contents at the requested root."""
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "source"
            native_scanner.extract_source(
                archive_bytes("project/src/main.c"), destination
            )
            self.assertEqual((destination / "src/main.c").read_bytes(), b"source\n")

    def test_traversal_and_escaping_links_are_rejected(self) -> None:
        """An archive cannot write outside the assigned source root."""
        cases = [
            archive_bytes("project/../../outside"),
            archive_bytes("/outside"),
            archive_bytes("project/escape", link="../../outside"),
        ]
        for blob in cases:
            with (
                self.subTest(blob=hashlib.sha256(blob).hexdigest()),
                tempfile.TemporaryDirectory() as temporary,
            ):
                destination = Path(temporary) / "source"
                with self.assertRaises((ValueError, tarfile.TarError)):
                    native_scanner.extract_source(blob, destination)
                self.assertFalse((Path(temporary) / "outside").exists())


class ParserPatchIntegrityTests(unittest.TestCase):
    """The custom parser patch may modify only its reviewed exact preimages."""

    def test_exact_patch_changes_only_its_recorded_file(self) -> None:
        """A valid preimage and postimage permit the reviewed transformation."""
        before = b"old\n"
        after = b"new\n"
        patch = b"--- a/a.ml\n+++ b/a.ml\n@@ -1 +1 @@\n-old\n+new\n"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            source.mkdir()
            (source / "a.ml").write_bytes(before)
            (source / "untouched.ml").write_bytes(b"preserved\n")
            native_scanner.apply_reviewed_patch(
                source, patch, hashlib.sha256(patch).hexdigest(),
                [{"path": "a.ml", "before_sha256": hashlib.sha256(before).hexdigest(),
                  "after_sha256": hashlib.sha256(after).hexdigest()}],
            )
            self.assertEqual((source / "a.ml").read_bytes(), after)
            self.assertEqual((source / "untouched.ml").read_bytes(), b"preserved\n")

    def test_changed_patch_or_unreviewed_target_is_rejected_before_application(self) -> None:
        """A matching source file cannot authorize changed patch bytes or scope."""
        patch = b"--- a/a.ml\n+++ b/a.ml\n@@ -1 +1 @@\n-old\n+new\n"
        cases = [([], hashlib.sha256(patch).hexdigest()),
                 ([{"path": "a.ml", "before_sha256": "0" * 64,
                    "after_sha256": "1" * 64}], hashlib.sha256(patch).hexdigest()),
                 ([{"path": "../a.ml", "before_sha256": "0" * 64,
                    "after_sha256": "1" * 64}], hashlib.sha256(patch).hexdigest()),
                 ([{"path": "a.ml", "before_sha256": "0" * 64,
                    "after_sha256": "1" * 64}], "0" * 64)]
        for records, digest in cases:
            with self.subTest(records=records), tempfile.TemporaryDirectory() as temporary:
                source = Path(temporary)
                (source / "a.ml").write_bytes(b"old\n")
                with self.assertRaises((RuntimeError, ValueError)):
                    native_scanner.apply_reviewed_patch(source, patch, digest, records)
                self.assertEqual((source / "a.ml").read_bytes(), b"old\n")

    def test_hidden_extra_patch_target_is_rejected(self) -> None:
        """An otherwise valid patch cannot include an unrecorded second file."""
        patch = (b"--- a/a.ml\n+++ b/a.ml\n@@ -1 +1 @@\n-old\n+new\n"
                 b"--- a/b.ml\n+++ b/b.ml\n@@ -1 +1 @@\n-safe\n+changed\n")
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary)
            (source / "a.ml").write_bytes(b"old\n")
            (source / "b.ml").write_bytes(b"safe\n")
            with self.assertRaises(ValueError):
                native_scanner.apply_reviewed_patch(
                    source, patch, hashlib.sha256(patch).hexdigest(),
                    [{"path": "a.ml", "before_sha256": hashlib.sha256(b"old\n").hexdigest(),
                      "after_sha256": hashlib.sha256(b"new\n").hexdigest()}],
                )
            self.assertEqual((source / "b.ml").read_bytes(), b"safe\n")


    def test_wrong_postimage_cannot_be_accepted(self) -> None:
        """A successful patch command still must produce the reviewed exact bytes."""
        patch = b"--- a/a.ml\n+++ b/a.ml\n@@ -1 +1 @@\n-old\n+new\n"
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary)
            (source / "a.ml").write_bytes(b"old\n")
            with self.assertRaisesRegex(RuntimeError, "digest mismatch"):
                native_scanner.apply_reviewed_patch(
                    source, patch, hashlib.sha256(patch).hexdigest(),
                    [{"path": "a.ml", "before_sha256": hashlib.sha256(b"old\n").hexdigest(),
                      "after_sha256": hashlib.sha256(b"different\n").hexdigest()}],
                )

    def test_linked_target_or_parent_cannot_change_external_source(self) -> None:
        """Neither a target symlink nor an ancestor may redirect a reviewed patch."""
        for linked_parent in (False, True):
            with (
                self.subTest(linked_parent=linked_parent),
                tempfile.TemporaryDirectory() as temporary,
            ):
                root = Path(temporary)
                source = root / "source"
                outside = root / "outside"
                source.mkdir()
                outside.mkdir()
                (outside / "a.ml").write_bytes(b"old\n")
                name = "nested/a.ml" if linked_parent else "a.ml"
                if linked_parent:
                    (source / "nested").symlink_to(outside, target_is_directory=True)
                else:
                    (source / "a.ml").symlink_to(outside / "a.ml")
                patch = f"--- a/{name}\n+++ b/{name}\n@@ -1 +1 @@\n-old\n+new\n".encode()
                with self.assertRaisesRegex(ValueError, "symbolic links"):
                    native_scanner.apply_reviewed_patch(
                        source, patch, hashlib.sha256(patch).hexdigest(),
                        [{"path": name, "before_sha256": hashlib.sha256(b"old\n").hexdigest(),
                          "after_sha256": hashlib.sha256(b"new\n").hexdigest()}],
                    )
                self.assertEqual((outside / "a.ml").read_bytes(), b"old\n")


class NativeCLIContractTests(unittest.TestCase):
    """A reported clean scan cannot hide missing schema, targets or findings."""

    def test_precise_findings_and_scope_are_accepted(self) -> None:
        """The verifier accepts only the complete expected real CLI result."""
        case = {"exit_code": 1, "scanned_paths": ["input.py"],
                "findings": [["control", "input.py", 2]]}
        report = {"errors": [], "paths": {"scanned": ["input.py"]},
                  "results": [{"check_id": "control", "path": "input.py", "start": {"line": 2}}]}
        self.assertEqual(scanner_contracts.inspect_case(report, 1, case)["findings"], 1)

    def test_missing_or_changed_result_fields_are_rejected(self) -> None:
        """Zero errors alone cannot certify a complete compatible result."""
        case = {"exit_code": 1, "scanned_paths": ["input.py"],
                "findings": [["control", "input.py", 2]]}
        baseline: dict[str, Any] = {"errors": [], "paths": {"scanned": ["input.py"]},
                    "results": [{"check_id": "control", "path": "input.py", "start": {"line": 2}}]}
        changes: list[dict[str, Any]] = [
                   {"errors": None}, {"paths": {}}, {"paths": {"scanned": []}},
                   {"results": []}, {"results": [{"check_id": "control"}]},
                   {"errors": [{"type": "PartialParsing"}]}]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                scanner_contracts.inspect_case({**baseline, **change}, 1, case)
        with self.assertRaises(ValueError):
            scanner_contracts.inspect_case(baseline, 0, case)

    def test_unrelated_failure_cannot_satisfy_a_negative_parser_control(self) -> None:
        """A crashed scanner cannot masquerade as intentional syntax rejection."""
        case = {"exit_code": 3, "scanned_paths": [], "findings": [],
                "error_types": ["PartialParsing"], "error_file": "broken.py"}
        for errors in ([], [{"type": "Fatal error", "path": "broken.py"}],
                       [{"type": "PartialParsing", "path": "unrelated.py"}]):
            with self.subTest(errors=errors), self.assertRaises(ValueError):
                scanner_contracts.inspect_case(
                    {"errors": errors, "results": [], "paths": {"scanned": []}}, 3, case,
                )

    def test_missing_duplicate_or_foreign_profile_rules_are_rejected(self) -> None:
        """A pre-scan dump cannot replace complete actual fixture scan profiling."""
        expected = ["first", "second"]
        self.assertEqual(
            scanner_contracts.rule_ids_from_profile(
                {"time": {"rules": ["second", "first"]}}, expected,
            ), expected,
        )
        for rules in (None, [], ["first"], ["first", "first", "second"],
                      ["first", "foreign"], ["first", 2]):
            with self.subTest(rules=rules), self.assertRaises(ValueError):
                scanner_contracts.rule_ids_from_profile({"time": {"rules": rules}}, expected)
        reports: tuple[dict[str, Any], ...] = ({}, {"time": None}, {"time": []})
        for report in reports:
            with self.subTest(report=report), self.assertRaises(ValueError):
                scanner_contracts.rule_ids_from_profile(report, expected)

    def test_actual_cli_controls_request_production_profile(self) -> None:
        """Every real fixture scan must produce the profile consumed by production."""
        command = scanner_contracts.scan_arguments(Path("native/opengrep"), ["rules.json"],
                                                  Path("report.json"))
        self.assertEqual(command.count("--time"), 1)
        self.assertEqual(command[command.index("--max-target-bytes") + 1], "0")

    def test_cli_failure_keeps_all_diagnostics_and_fails_overall(self) -> None:
        """An early failed control cannot hide later failures or become a pass."""
        source = "value = 1\n"
        fixtures = {
            "fixtures": [
                {"id": name, "source": source,
                 "source_sha256": hashlib.sha256(source.encode()).hexdigest(),
                 "expect_parse": "success"}
                for name in ("first", "middle")
            ]
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            python_fixtures = root / "python.json"
            python_fixtures.write_text(json.dumps(fixtures))
            cli_fixtures = root / "cli.json"
            cli_fixtures.write_text(json.dumps({"cases": [{"id": "last"}]}))
            output = root / "output"
            arguments = [
                "controls", "--scanner", str(root / "scanner"), "--output", str(output),
                "--python-fixtures", str(python_fixtures), "--cli-fixtures", str(cli_fixtures),
            ]
            with (
                patch.object(sys, "argv", arguments),
                patch.object(scanner_contracts, "run_case", side_effect=[
                    ValueError("first control failed"),
                    {"id": "middle", "status": "passed"},
                    ValueError("last control failed"),
                ]) as execute,
            ):
                self.assertEqual(scanner_contracts.main(), 1)
            self.assertEqual(execute.call_count, 3)
            report = json.loads((output / "summary.json").read_text())
            self.assertEqual(report["status"], "failed")
            self.assertEqual(report["expected_cases"], ["first", "middle", "last"])
            self.assertEqual([case["id"] for case in report["cases"]], report["expected_cases"])
            self.assertEqual([case["status"] for case in report["cases"]],
                             ["failed", "passed", "failed"])

    def test_ast_qualification_rejects_missing_or_wrong_outcomes(self) -> None:
        """Every native fixture must produce its specific parsing/AST outcome."""
        fixtures: list[dict[str, Any]] = [
                    {"id": "valid", "expect_parse": "success", "declarations": [{}]},
                    {"id": "invalid", "expect_parse": "reject", "declarations": []}]
        report = {"status": "passed", "frontend": "Parse_python.Python3 (Menhir)",
                  "fixtures": [{"id": "valid", "result": "parsed-and-asserted",
                                "declarations_checked": 1},
                               {"id": "invalid", "result": "rejected"}]}
        native_scanner.inspect_parser_qualification(report, fixtures)
        for change in ({"fixtures": report["fixtures"][:1]}, {"status": "failed"},
                       {"frontend": "other parser"},
                       {"fixtures": [{"id": "valid", "result": "parsed-and-asserted",
                                      "declarations_checked": 0}, report["fixtures"][1]]}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                native_scanner.inspect_parser_qualification({**report, **change}, fixtures)

    def test_non_native_or_unexecutable_cache_entry_is_rejected(self) -> None:
        """A receipt cannot authorize a script, missing output, or unusable binary."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "opengrep-core"
            for blob, mode in ((b"#!/bin/sh\nexit 0\n", 0o755), (b"\x7fELF", 0o644)):
                target.write_bytes(blob)
                target.chmod(mode)
                with self.subTest(mode=mode), self.assertRaises(RuntimeError):
                    native_scanner.native_executable(root, "opengrep-core")


class ParserQualificationIntegrityTests(unittest.TestCase):
    """A cached wheel must still execute the reviewed parser and control inputs."""

    def test_installed_core_must_equal_the_built_core(self) -> None:
        """Another executable in site-packages cannot satisfy native qualification."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            native = root / "native"
            native.mkdir()
            core = native / "opengrep-core"
            core.write_bytes(b"\x7fELFfixture-core")
            core.chmod(0o755)
            installed = root / "venv/lib/python3.12/site-packages/semgrep/bin/opengrep-core"
            installed.parent.mkdir(parents=True)
            installed.write_bytes(core.read_bytes())
            cli = root / "venv/bin/opengrep"
            cli.parent.mkdir()
            cli.write_text("# fixture entrypoint\n")
            cli.chmod(0o755)
            self.assertEqual(native_scanner.installed_scanner(root), cli)
            installed.write_bytes(b"\x7fELFdifferent-core")
            with self.assertRaisesRegex(RuntimeError, "digest mismatch"):
                native_scanner.installed_scanner(root)

    def test_changed_patch_overlay_fixture_or_runner_invalidates_cache_inputs(self) -> None:
        """Cached outputs cannot conceal edits to any reviewed executable input."""
        package = json.loads(
            (native_scanner.HERE / "parser-backports/source-manifest.json").read_text()
        )
        names = (
            "parser-backports/" + package["patch"]["path"],
            "parser-backports/" + package["build_source_overlay"][1]["source_path"],
            "parser-backports/python-parser-fixtures.json",
            "scanner_contracts.py",
        )
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "security"
            shutil.copytree(native_scanner.HERE, root, ignore=shutil.ignore_patterns("__pycache__"))
            with patch.object(native_scanner, "HERE", root):
                expected = native_scanner.input_identity()
                for name in names:
                    with self.subTest(name=name):
                        target = root / name
                        before = target.read_bytes()
                        target.write_bytes(before + b"\nchanged\n")
                        with self.assertRaisesRegex(RuntimeError, "digest mismatch"):
                            native_scanner.input_identity()
                        target.write_bytes(before)
                        self.assertEqual(native_scanner.input_identity(), expected)

    def test_failed_qualification_cannot_produce_a_cache_receipt(self) -> None:
        """A completed build with failed controls remains unusable as a cache."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaisesRegex(ValueError, "unqualified"):
                native_scanner.seal_cache(root, "0" * 64, {"status": "failed"})
            self.assertFalse((root / "receipt.json").exists())


class AuditCompletenessTests(unittest.TestCase):
    """Every locked component needs an explicit complete vulnerability result."""

    def test_completed_clean_batch_is_accepted(self) -> None:
        """A complete response with no findings is a successful audit."""
        self.assertEqual(native_scanner.inspect_osv({"results": [{}, {}]}, 2), [])

    def test_findings_are_preserved(self) -> None:
        """A finding must reach the caller and fail the security gate."""
        self.assertEqual(
            native_scanner.inspect_osv(
                {
                    "results": [
                        {
                            "vulns": [
                                {"id": "TEST-1", "modified": "2026-11-05T00:00:00Z"}
                            ]
                        }
                    ]
                },
                1,
            ),
            [{"query_index": 0, "id": "TEST-1", "modified": "2026-11-05T00:00:00Z"}],
        )

    def test_missing_partial_empty_and_paginated_results_are_rejected(self) -> None:
        """Absent or incomplete OSV data must never look like a clean audit."""
        cases = [
            ({}, 1),
            ({"results": []}, 1),
            ({"results": [{}]}, 2),
            ({"results": []}, 0),
            ({"results": [{"next_page_token": "remaining"}]}, 1),
            ({"results": [{"vulns": {}}]}, 1),
            ({"results": [{"vulns": [{}]}]}, 1),
        ]
        for report, count in cases:
            with (
                self.subTest(report=report, count=count),
                self.assertRaises(ValueError),
            ):
                native_scanner.inspect_osv(report, count)

    def test_changed_or_omitted_installed_dependency_is_rejected(self) -> None:
        """An installed switch must exactly match the audited frozen inventory."""
        expected = {"ocaml": "5.5.2", "yaml": "3.2.0"}
        for actual in ({"ocaml": "5.5.2"}, {"ocaml": "5.5.1", "yaml": "3.2.0"}):
            with self.subTest(actual=actual), self.assertRaises(ValueError):
                native_scanner.validate_inventory(expected, actual)

    def test_saved_audit_with_missing_locked_components_is_rejected(self) -> None:
        """A zero-exit process cannot certify an omitted or different dependency."""
        expected = [{"commit": "1" * 40}, {"commit": "2" * 40}]
        report = {"status": "passed", "queries": expected[:1], "results": [{}]}
        with self.assertRaises(ValueError):
            native_scanner.inspect_audit_report(report, expected)

    def test_saved_audit_cannot_hide_advisories_behind_passed_status(self) -> None:
        """The gate independently counts raw results even after exit zero."""
        expected = [{"commit": "1" * 40}]
        report = {
            "status": "passed",
            "queries": expected,
            "results": [{"vulns": [{"id": "TEST-1"}]}],
        }
        result = native_scanner.inspect_audit_report(report, expected)
        self.assertEqual(result["blocking_findings"], 1)


class CompilerClosureTests(unittest.TestCase):
    """Compiler features cannot silently add an unaudited host library."""

    def test_explicit_no_compression_configuration_is_accepted(self) -> None:
        """The same supported compiler without compression has no zstd input."""
        native_scanner.validate_compiler_configuration(
            {"version": "5.5.2", "compression_c_libraries": ""},
            "version: 5.5.2\ncompression_c_libraries: \nnative_compiler: true\n",
        )

    def test_enabled_missing_or_ambiguous_configuration_is_rejected(self) -> None:
        """Host auto-detection, omitted evidence and duplicate settings fail."""
        expected = {"version": "5.5.2", "compression_c_libraries": ""}
        cases = [
            "version: 5.5.2\ncompression_c_libraries: -lzstd\n",
            "version: 5.5.2\n",
            "version: 5.5.1\ncompression_c_libraries: \n",
            "version: 5.5.2\ncompression_c_libraries: \ncompression_c_libraries: \n",
            "version: 5.5.2\nmalformed setting\ncompression_c_libraries: \n",
        ]
        for output in cases:
            with self.subTest(output=output), self.assertRaises(ValueError):
                native_scanner.validate_compiler_configuration(expected, output)

    def test_hosted_unrecorded_zstd_linkage_remains_rejected(self) -> None:
        """The observed hosted libzstd failure remains a blocking regression."""
        linked = (
            "\tlinux-vdso.so.1 (0x00007ff3972b3000)\n"
            "\tlibzstd.so.1 => /lib/x86_64-linux-gnu/libzstd.so.1 "
            "(0x00007ff3971e7000)\n"
            "\tlibgmp.so.10 => /private/native/lib/libgmp.so.10 "
            "(0x00007ff397163000)\n"
            "\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 "
            "(0x00007ff38b400000)\n"
        )
        with self.assertRaisesRegex(RuntimeError, "Unrecorded.*libzstd"):
            native_scanner.validate_scanner_libraries(linked)

    def test_other_unverified_or_unresolved_libraries_remain_rejected(self) -> None:
        """The compiler repair cannot bypass unknown, missing or PCRE2 checks."""
        cases = [
            "libunexpected.so.1 => /lib/libunexpected.so.1 (0x1)\n",
            "libgmp.so.10 => not found\n",
            "libpcre2-8.so.0 => /lib/libpcre2-8.so.0 (0x1)\n",
        ]
        for output in cases:
            with self.subTest(output=output), self.assertRaises(RuntimeError):
                native_scanner.validate_scanner_libraries(output)

    def test_recorded_library_closure_is_accepted(self) -> None:
        """The original bundled and system-runtime library set still passes."""
        native_scanner.validate_scanner_libraries(
            "libgmp.so.10 => /private/native/lib/libgmp.so.10 (0x1)\n"
            "libtree-sitter.so.0 => /private/native/lib/libtree-sitter.so.0 (0x1)\n"
            "libev.so.4 => /private/native/lib/libev.so.4 (0x1)\n"
            "libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x1)\n"
        )


class SandboxIntegrityTests(unittest.TestCase):
    """An absent helper or disabled opam wrapper must never authorize a build."""

    def test_verified_helper_is_required_even_when_host_bwrap_exists(self) -> None:
        """A system executable cannot conceal a missing locked build input."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            host = root / "host"
            host.mkdir()
            (host / "bwrap").write_text("#!/bin/sh\nexit 0\n")
            (host / "bwrap").chmod(0o755)
            manifest = {"assets": [{"name": "bubblewrap", "executable_sha256": "0" * 64}]}
            with self.assertRaises(RuntimeError):
                native_scanner.verified_sandbox_helper(root, manifest, str(host))

    def test_changed_or_shadowed_helper_is_rejected(self) -> None:
        """Only the exact extracted executable at the selected path is trusted."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            helper = root / "sysroot/usr/bin/bwrap"
            helper.parent.mkdir(parents=True)
            original = b"#!/bin/sh\nexit 0\n"
            helper.write_bytes(original)
            helper.chmod(0o755)
            manifest = {
                "assets": [
                    {
                        "name": "bubblewrap",
                        "executable_sha256": hashlib.sha256(original).hexdigest(),
                    }
                ]
            }
            self.assertEqual(
                native_scanner.verified_sandbox_helper(root, manifest, str(helper.parent)),
                helper,
            )
            host = root / "host"
            host.mkdir()
            (host / "bwrap").write_bytes(original)
            (host / "bwrap").chmod(0o755)
            with self.assertRaises(RuntimeError):
                native_scanner.verified_sandbox_helper(root, manifest, f"{host}:{helper.parent}")
            helper.write_bytes(b"#!/bin/sh\nexit 1\n")
            with self.assertRaises(RuntimeError):
                native_scanner.verified_sandbox_helper(root, manifest, str(helper.parent))

    def test_only_the_enabled_upstream_sandbox_hooks_are_accepted(self) -> None:
        """An init success with empty or altered wrappers remains a failure."""
        for phase in ("build", "install", "remove"):
            expected = f'["%{{hooks}}%/sandbox.sh" "{phase}"] {{os = "linux" | os = "macos"}}'
            native_scanner.require_sandbox_hook(expected + "\n", phase)
            for value in ("", "[]", expected + " []", expected.replace("linux", "unknown")):
                with self.subTest(phase=phase, value=value), self.assertRaises(RuntimeError):
                    native_scanner.require_sandbox_hook(value, phase)

    def test_tampered_sandbox_policy_is_rejected(self) -> None:
        """Changed downloaded policy cannot authorize namespace capabilities."""
        with self.assertRaises(RuntimeError):
            native_scanner.sandbox_profile(b"changed policy", "0" * 64)

    def test_incomplete_sandbox_policy_is_rejected(self) -> None:
        """An unexpected policy cannot silently omit its child restrictions."""
        policy = b"profile bwrap /usr/bin/bwrap { allow capability, }\n"
        with self.assertRaises(ValueError):
            native_scanner.sandbox_profile(
                policy, hashlib.sha256(policy).hexdigest()
            )

    def test_writable_or_linked_helper_paths_are_rejected(self) -> None:
        """Root-only bytes need protected ancestors and a regular path."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            root.chmod(0o777)
            helper = root / "bwrap"
            helper.write_bytes(b"verified helper")
            helper.chmod(0o555)
            with self.assertRaises(RuntimeError):
                native_scanner.require_root_owned_path(helper)
            link = root / "linked-helper"
            link.symlink_to(helper)
            with self.assertRaises(RuntimeError):
                native_scanner.require_root_owned_path(link)

    def test_sandbox_child_requires_the_enforced_capability_stripping_stack(self) -> None:
        """A successful process alone cannot prove the intended policy applies."""
        expected = "rezwan-native-bwrap//&rezwan-native-unpriv-bwrap (enforce)"
        status = (
            "\nCapEff:\t0000000000000000\nCapPrm:\t0000000000000000\n"
            "NoNewPrivs:\t1\n"
        )
        native_scanner.require_sandbox_profile(expected + status)
        for value in (
            "unconfined",
            "rezwan-native-bwrap (enforce)",
            expected.replace("enforce", "complain"),
        ):
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                native_scanner.require_sandbox_profile(value + status)
        for incorrect in (
            "",
            status.replace("NoNewPrivs:\t1", "NoNewPrivs:\t0"),
            status.replace("0000000000000000", "0000000000000001"),
        ):
            with self.subTest(status=incorrect), self.assertRaises(RuntimeError):
                native_scanner.require_sandbox_profile(expected + incorrect)


class CachedBuildIntegrityTests(unittest.TestCase):
    """Restored builds must match their locked inputs and recorded output bytes."""

    def test_modified_cached_executable_is_rejected(self) -> None:
        """A cache hit cannot authorize changed scanner bytes."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "opengrep-core").write_bytes(b"changed")
            receipt = {
                "input_sha256": "locked-inputs",
                "files": {"opengrep-core": hashlib.sha256(b"original").hexdigest()},
            }
            (root / "receipt.json").write_text(json.dumps(receipt))
            with self.assertRaises(RuntimeError):
                native_scanner.verify_cache(root, "locked-inputs")

    def test_missing_cache_requests_a_build(self) -> None:
        """An absent receipt must result in a source build rather than success."""
        with tempfile.TemporaryDirectory() as temporary:
            self.assertFalse(
                native_scanner.verify_cache(Path(temporary), "locked-inputs")
            )


class BuildFailureEvidenceTests(unittest.TestCase):
    """Failed external build steps must retain a truthful terminal receipt."""

    def test_timed_out_build_is_recorded_as_failed(self) -> None:
        """A killed build cannot leave a running or successful phase receipt."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            builder = native_scanner.Builder(root, root / "logs", {})
            builder.work.mkdir()
            with self.assertRaises(subprocess.TimeoutExpired):
                builder.command(
                    "timeout-fixture",
                    [sys.executable, "-c", "import time; time.sleep(5)"],
                    timeout=1,
                )
            report = json.loads((root / "logs/native-build-stages.json").read_text())
            self.assertEqual(report[0]["status"], "failed")
            self.assertIn("TimeoutExpired", report[0]["error"])


if __name__ == "__main__":
    unittest.main()
