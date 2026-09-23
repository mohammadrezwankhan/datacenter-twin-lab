import json
from decimal import Decimal
from fractions import Fraction
import hashlib
from pathlib import Path
import tempfile
import unittest

from datacenter_twin.contracts import InputError
from scripts.build_evidence import (
    ROOT,
    _cases,
    build_packet,
    main,
    verify_packet,
)


class EvidencePackageTests(unittest.TestCase):
    def test_independent_expectations_match_lesson_and_path_observations(self):
        cases = _cases()
        self.assertEqual(
            [case["case_id"] for case in cases],
            [
                "canonical-1mw-100kwh",
                "canonical-1mw-50kwh",
                "path-maintenance-700kw",
            ],
        )
        expected_by_case = {
            case["case_id"]: {check["metric"]: check for check in case["checks"]}
            for case in cases
        }
        self.assertEqual(
            expected_by_case["canonical-1mw-100kwh"]["ride_through_s"]["expected"],
            "307.8",
        )
        self.assertEqual(
            expected_by_case["canonical-1mw-100kwh"]["depletion_elapsed_s"]["expected"],
            "607.8",
        )
        first_unserved = Fraction(
            Decimal(expected_by_case["canonical-1mw-100kwh"]["unserved_it_kwh"]["expected"])
        )
        self.assertLess(abs(first_unserved - Fraction(487, 6)), Fraction(1, 10**90))
        self.assertEqual(
            expected_by_case["canonical-1mw-50kwh"]["ride_through_s"]["expected"],
            "153.9",
        )
        self.assertEqual(
            expected_by_case["canonical-1mw-50kwh"]["depletion_elapsed_s"]["expected"],
            "453.9",
        )
        second_unserved = Fraction(
            Decimal(expected_by_case["canonical-1mw-50kwh"]["unserved_it_kwh"]["expected"])
        )
        self.assertLess(abs(second_unserved - Fraction(1487, 12)), Fraction(1, 10**90))
        path = expected_by_case["path-maintenance-700kw"]
        self.assertEqual(path["requested_it_kwh"]["expected"], "500")
        self.assertEqual(path["served_kw_during_maintenance"]["expected"], "665")
        self.assertEqual(path["unserved_kw_during_maintenance"]["expected"], "335")
        self.assertEqual(path["unserved_duration_s"]["expected"], "600")
        path_unserved = Fraction(Decimal(path["unserved_it_kwh"]["expected"]))
        self.assertLess(abs(path_unserved - Fraction(335, 6)), Fraction(1, 10**90))
        self.assertTrue(all(check["status"] == "match" for case in cases for check in case["checks"]))
        self.assertTrue(all(case["ledger"]["status"] == "pass" for case in cases))

    def test_course_scenarios_follow_the_browser_lesson_recipe(self):
        cases = _cases()
        for case, initial in zip(cases[:2], ("100", "50")):
            with self.subTest(initial=initial):
                self.assertEqual(case["scenario_id"], "course-ride-through")
                self.assertEqual(case["checks"][0]["observed"], "500")
        # Inspect the case JSON from the in-memory builder inputs through the run payloads
        # created below; source id de-duplication and fixed charging are also in the hash.
        with tempfile.TemporaryDirectory() as tmp:
            packet = Path(tmp) / "packet"
            build_packet(packet)
            for case, initial in zip(cases[:2], ("100", "50")):
                scenario_path = packet / case["scenario_file"]
                scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
                self.assertEqual(scenario["name"], "3. Calculate battery ride-through")
                self.assertEqual(scenario["battery_charge_kw"], "0")
                self.assertEqual(scenario["battery_initial_kwh"], initial)
                self.assertEqual(scenario["source_ids"].count("EDU-POWER-001"), 1)

    def test_repeated_packet_artifacts_are_identical_and_content_addressed(self):
        with tempfile.TemporaryDirectory() as tmp:
            first = Path(tmp) / "first"
            second = Path(tmp) / "second"
            build_packet(first, revision="abc123", repository="owner/public-repo")
            build_packet(second, revision="abc123", repository="owner/public-repo")
            first_files = {path.name: path.read_bytes() for path in first.iterdir()}
            second_files = {path.name: path.read_bytes() for path in second.iterdir()}
            self.assertEqual(first_files, second_files)
            manifest = json.loads((first / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["independent_review"]["status"], "not_obtained")
            for case in manifest["cases"]:
                self.assertIn(case["input_sha256"], case["run_file"])
                self.assertIn(case["input_sha256"], case["scenario_file"])
                self.assertIn(case["input_sha256"], case["markdown_report_file"])
                self.assertIn(case["input_sha256"], case["html_report_file"])
            all_artifact_bytes = b"\n".join(first_files.values())
            self.assertNotIn(str(first).encode(), all_artifact_bytes)
            self.assertNotIn(str(second).encode(), all_artifact_bytes)
            self.assertEqual(
                manifest["public_context"],
                {"repository": "owner/public-repo", "revision": "abc123"},
            )

    def test_manifest_verification_detects_tampering(self):
        with tempfile.TemporaryDirectory() as tmp:
            packet = Path(tmp) / "packet"
            build_packet(packet)
            result = verify_packet(packet)
            self.assertEqual(result["status"], "integrity_and_reproduction_verified")
            manifest = json.loads((packet / "manifest.json").read_text(encoding="utf-8"))
            target = packet / next(
                case["run_file"] for case in manifest["cases"]
            )
            target.write_bytes(target.read_bytes() + b" ")
            with self.assertRaisesRegex(InputError, "SHA-256 mismatch"):
                verify_packet(packet)

    def test_rehashed_forged_run_is_rejected_by_semantic_reproduction(self):
        with tempfile.TemporaryDirectory() as tmp:
            packet = Path(tmp) / "packet"
            build_packet(packet)
            manifest_path = packet / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            run_name = manifest["cases"][0]["run_file"]
            run_path = packet / run_name
            run_path.write_text('{"forged":true}\n', encoding="utf-8")
            manifest["artifacts"][run_name]["sha256"] = hashlib.sha256(
                run_path.read_bytes()
            ).hexdigest()
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(InputError, "hash for .* does not match current reproduction"):
                verify_packet(packet)

    def test_empty_packet_and_forged_expected_checks_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            empty = Path(tmp) / "empty"
            empty.mkdir()
            (empty / "manifest.json").write_text(
                json.dumps({"artifacts": {}}), encoding="utf-8"
            )
            with self.assertRaises(InputError):
                verify_packet(empty)

            packet = Path(tmp) / "packet"
            build_packet(packet)
            manifest_path = packet / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["cases"][0]["checks"][0]["expected"] = "0"
            manifest["cases"][0]["checks"][0]["observed"] = "0"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(InputError, "'cases'.*current reproduction"):
                verify_packet(packet)

            duplicate = Path(tmp) / "duplicate"
            duplicate.mkdir()
            (duplicate / "manifest.json").write_text(
                '{"schema_version":1,"schema_version":1,"artifacts":{}}',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(InputError, "Duplicate JSON object key"):
                verify_packet(duplicate)

    def test_unsupported_version_malformed_context_and_missing_case_are_rejected(self):
        mutations = (
            ("engine_version", "0.0.0"),
            ("public_context", {"repository": ["not", "a", "string"]}),
            ("cases", "missing case records"),
        )
        for field, value in mutations:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as tmp:
                packet = Path(tmp) / "packet"
                build_packet(packet)
                manifest_path = packet / "manifest.json"
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                if field == "cases":
                    manifest[field].pop()
                else:
                    manifest[field] = value
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
                with self.assertRaises(InputError):
                    verify_packet(packet)

    def test_cross_environment_metadata_is_shape_checked_but_not_host_pinned(self):
        with tempfile.TemporaryDirectory() as tmp:
            packet = Path(tmp) / "packet"
            build_packet(packet)
            manifest_path = packet / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            environment_path = packet / "environment.json"
            environment = json.loads(environment_path.read_text(encoding="utf-8"))
            environment.update(
                python_version="3.14.0",
                operating_system="Linux",
                operating_system_release="6.12.0",
                machine_architecture="x86_64",
            )
            environment_path.write_text(json.dumps(environment, sort_keys=True) + "\n", encoding="utf-8")
            manifest["artifacts"]["environment.json"]["sha256"] = hashlib.sha256(
                environment_path.read_bytes()
            ).hexdigest()
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            self.assertEqual(
                verify_packet(packet)["status"],
                "integrity_and_reproduction_verified",
            )

    def test_manifest_artifact_paths_reject_windows_separators_and_drives(self):
        for unsafe_name in (r"..\outside.json", "C:/outside.json", "C:outside.json"):
            with self.subTest(name=unsafe_name), tempfile.TemporaryDirectory() as tmp:
                packet = Path(tmp) / "packet"
                build_packet(packet)
                manifest_path = packet / "manifest.json"
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                old_name = next(iter(manifest["artifacts"]))
                manifest["artifacts"][unsafe_name] = manifest["artifacts"].pop(old_name)
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
                with self.assertRaisesRegex(InputError, "Unsafe artifact path"):
                    verify_packet(packet)

    def test_verifier_rejects_symlinked_packet_path_component(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            actual_root = base / "actual"
            packet = actual_root / "packet"
            build_packet(packet)
            alias = base / "alias"
            try:
                alias.symlink_to(actual_root, target_is_directory=True)
            except OSError as exc:
                self.skipTest(f"Symlink creation is unavailable: {exc}")
            with self.assertRaisesRegex(InputError, "symbolic-link directory"):
                verify_packet(alias / "packet")

    def test_build_refuses_existing_destination_and_protects_source_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "existing"
            destination.mkdir()
            sentinel = destination / "keep.txt"
            sentinel.write_text("keep", encoding="utf-8")
            with self.assertRaisesRegex(InputError, "already exists"):
                build_packet(destination)
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep")
        with self.assertRaisesRegex(InputError, "under outputs"):
            build_packet(ROOT / "datacenter_twin" / "evidence-test")

    def test_flag_style_cli_build_and_verify(self):
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "packet"
            self.assertEqual(
                main(["--output", str(destination), "--revision", "public-commit"]),
                0,
            )
            self.assertEqual(main(["--verify", str(destination)]), 0)


if __name__ == "__main__":
    unittest.main()
