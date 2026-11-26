"""Keep the battery power/energy lesson tied to independently derived outcomes."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from copy import deepcopy
from fractions import Fraction
from pathlib import Path

from datacenter_twin.continuity import simulate_continuity
from scripts.reproduce_battery_limits import CASES, load_case, verify_case

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/reproduce_battery_limits.py"


class BatteryLimitsLessonTests(unittest.TestCase):
    def test_experiment_changes_only_stored_energy_and_battery_power(self) -> None:
        controls = []
        for name in CASES:
            data = load_case(name).to_dict()
            for field in ("id", "name", "battery_capacity_kwh", "battery_initial_kwh"):
                del data[field]
            for asset in data["assets"]:
                if asset["id"] == "battery":
                    del asset["capacity_kw"]
            controls.append(data)
        self.assertEqual(len(controls), 4)
        self.assertTrue(all(control == controls[0] for control in controls[1:]))
        self.assertEqual(controls[0]["battery_charge_kw"], "0")
        self.assertIsNone(controls[0]["tariff_per_kwh"])
        self.assertIsNone(controls[0]["generator_cost_per_kwh"])

    def test_energy_shortfall_does_not_hide_different_power_histories(self) -> None:
        # Hand-derived values; the reproduction runner does not supply these expectations.
        expected = {
            "100kwh-600kw": (Fraction(487, 6), "600", "840", Fraction(0), "570"),
            "100kwh-1200kw": (Fraction(487, 6), "292.2", "607.8", Fraction(0), "1000"),
            "200kwh-600kw": (Fraction(215, 3), "600", None, Fraction(800, 9), "570"),
            "200kwh-1200kw": (Fraction(0), "0", None, Fraction(2600, 513), "1000"),
        }
        for name, (energy, duration, depletion, remaining, power) in expected.items():
            with self.subTest(case=name):
                result = simulate_continuity(load_case(name)).to_dict()
                verify_case(name, result)
                summary = result["summary"]
                self.assertLess(
                    abs(Fraction(summary["unserved_it_kwh"]) - energy), Fraction(1, 10**80)
                )
                self.assertEqual(summary["unserved_duration_s"], duration)
                self.assertLess(
                    abs(Fraction(summary["battery_final_kwh"]) - remaining), Fraction(1, 10**80)
                )
                self.assertIsNone(summary["total_incremental_energy_charge"])
                events = [e["at_s"] for e in result["events"] if e["action"] == "battery_depleted"]
                self.assertEqual(events, [] if depletion is None else [depletion])
                row = next(row for row in result["intervals"] if row["start_s"] == "300")
                self.assertEqual(row["served_it_kw"], power)

    def test_verifier_rejects_changed_intervals_even_with_unchanged_summary(self) -> None:
        result = simulate_continuity(load_case("200kwh-600kw")).to_dict()
        row = next(row for row in result["intervals"] if row["start_s"] == "300")
        row["served_it_kw"] = "571"
        with self.assertRaises(ValueError):
            verify_case("200kwh-600kw", result)

    def test_verifier_rejects_invented_cost_and_changed_event_or_summary(self) -> None:
        original = simulate_continuity(load_case("100kwh-1200kw")).to_dict()
        for field, value in (("unserved_it_kwh", "0"), ("total_incremental_energy_charge", "0")):
            with self.subTest(field=field):
                result = deepcopy(original)
                result["summary"][field] = value
                with self.assertRaises(ValueError):
                    verify_case("100kwh-1200kw", result)
        result = deepcopy(original)
        event = next(e for e in result["events"] if e["action"] == "battery_depleted")
        event["at_s"] = "608"
        with self.assertRaises(ValueError):
            verify_case("100kwh-1200kw", result)

    def test_cli_exports_reproducible_files_with_hashes_and_keeps_existing_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "results"
            command = [sys.executable, str(SCRIPT), "--output", str(target)]
            # Fixed interpreter and repository script; only a generated temporary path varies.
            run = subprocess.run(  # noqa: S603
                command, cwd=directory, text=True, capture_output=True, check=False
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(len(manifest["cases"]), 4)
            self.assertEqual(len(manifest["files"]), 12)
            before = {path.name: path.read_bytes() for path in target.iterdir()}
            for record in manifest["files"]:
                self.assertEqual(
                    hashlib.sha256(before[record["path"]]).hexdigest(), record["sha256"]
                )
            for case in manifest["cases"]:
                source = (ROOT / case["input_file"]).read_bytes()
                self.assertEqual(hashlib.sha256(source).hexdigest(), case["input_file_sha256"])
                result = json.loads(before[f"{case['case']}.json"])
                self.assertEqual(result["input_sha256"], case["input_sha256"])
                self.assertEqual(result["run_id"], case["run_id"])
            again = subprocess.run(  # noqa: S603 -- same trusted command; no shell
                command, cwd=directory, capture_output=True, check=False
            )
            self.assertNotEqual(again.returncode, 0)
            self.assertEqual(before, {path.name: path.read_bytes() for path in target.iterdir()})
            second = Path(directory) / "second"
            rerun = subprocess.run(  # noqa: S603 -- fixed interpreter and repository script
                [sys.executable, str(SCRIPT), "--output", str(second)],
                cwd=directory,
                capture_output=True,
                check=False,
            )
            self.assertEqual(rerun.returncode, 0, rerun.stderr)
            self.assertEqual(before, {path.name: path.read_bytes() for path in second.iterdir()})


if __name__ == "__main__":
    unittest.main()
