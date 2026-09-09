from dataclasses import replace
from fractions import Fraction
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

from datacenter_twin.contracts import InputError
from datacenter_twin.demo import demo_scenario
import datacenter_twin.sensitivity as sensitivity
from datacenter_twin.sensitivity import sweep_continuity


class SensitivityTests(unittest.TestCase):
    def setUp(self):
        # Disable pre-outage charging so the independently calculated opening
        # balances map directly to the 600-second generator-failure interval.
        self.scenario = replace(demo_scenario("generator_failure"), battery_charge_kw=0)

    def test_independent_ride_through_and_unserved_energy_expectations(self):
        result = sweep_continuity(self.scenario, "battery_initial_kwh", ["100", "50", "0"])
        self.assertEqual(result["values"], ["100", "50", "0"])
        by_value = {run["value"]: run for run in result["runs"]}

        # 100 kWh stored × 0.90 discharge × 0.95 distribution = 85.5 kWh
        # delivered at 1,000 kW, or 307.8 seconds after the t=300 outage.
        self.assertEqual(by_value["100"]["summary"]["first_battery_depletion_s"], "607.8")
        self.assertEqual(by_value["50"]["summary"]["first_battery_depletion_s"], "453.9")
        self.assertIsNone(by_value["0"]["summary"]["first_battery_depletion_s"])
        self.assertEqual(by_value["0"]["summary"]["unserved_seconds"], "600")

        requested_outage = Fraction(1000 * 600, 3600)
        delivered_100 = Fraction(100) * Fraction(9, 10) * Fraction(95, 100)
        expected_unserved_100 = requested_outage - delivered_100
        self.assertLess(abs(Fraction(by_value["100"]["summary"]["unserved_kwh"]) - expected_unserved_100), Fraction(1, 10**60))
        self.assertEqual(Fraction(by_value["100"]["summary"]["energy_balance_residual_kwh"]), 0)
        self.assertLess(abs(Fraction(by_value["50"]["summary"]["unserved_kwh"]) - (requested_outage - delivered_100 / 2)), Fraction(1, 10**60))
        self.assertLess(abs(Fraction(by_value["0"]["summary"]["unserved_kwh"]) - requested_outage), Fraction(1, 10**60))

        for run in result["runs"]:
            self.assertEqual(run["summary"]["energy_balance_residual_kwh"], "0")
            self.assertLess(abs(
                Fraction(run["summary"]["requested_kwh"])
                - Fraction(run["summary"]["served_kwh"])
                - Fraction(run["summary"]["unserved_kwh"])), Fraction(1, 10**60))

    def test_order_nonmutation_and_deterministic_full_details(self):
        before = self.scenario.to_dict()
        first = sweep_continuity(self.scenario, "distribution_efficiency", ["0.90", "0.95"])
        second = sweep_continuity(self.scenario, "distribution_efficiency", ["0.90", "0.95"])
        self.assertEqual(self.scenario.to_dict(), before)
        self.assertEqual(first, second)
        self.assertEqual([run["value"] for run in first["runs"]], ["0.9", "0.95"])
        self.assertTrue(first["full_results_included"])
        self.assertEqual([run["result"]["input_sha256"] for run in first["runs"]],
                         [run["input_sha256"] for run in first["runs"]])

    def test_invalid_parameter_and_values_are_actionable(self):
        invalid = [
            ("unknown", ["1"]), ([], ["1"]), ("battery_initial_kwh", []),
            ("battery_initial_kwh", [True]), ("battery_initial_kwh", ["NaN"]),
            ("battery_initial_kwh", ["101"]), ("generator_start_delay_s", ["1.5"]),
            ("distribution_efficiency", ["0"]), ("distribution_efficiency", ["1.1"]),
            ("battery_initial_kwh", ["1", "1.0"]),
            ("battery_initial_kwh", [str(i) for i in range(21)]),
        ]
        for parameter, values in invalid:
            with self.subTest(parameter=parameter, values=values), self.assertRaises(InputError):
                sweep_continuity(self.scenario, parameter, values)

    def test_result_details_stop_at_configured_bound(self):
        original_limit = sensitivity._MAX_FULL_RESULT_BYTES
        sensitivity._MAX_FULL_RESULT_BYTES = 1
        try:
            result = sweep_continuity(self.scenario, "battery_initial_kwh", ["0", "50", "100"])
        finally:
            sensitivity._MAX_FULL_RESULT_BYTES = original_limit
        self.assertFalse(result["full_results_included"])
        self.assertTrue(all("result" not in run for run in result["runs"]))
        self.assertTrue(all(run["summary"]["requested_kwh"] for run in result["runs"]))

    def test_cli_report_is_atomic_and_protects_scenario_input(self):
        root = Path(__file__).resolve().parents[1]
        with TemporaryDirectory() as directory:
            directory = Path(directory)
            output = directory / "nested" / "sweep.md"
            command = [sys.executable, "-m", "datacenter_twin", "sweep", "--preset", "generator_failure",
                       "--parameter", "battery_initial_kwh", "--values", "0", "50", "100",
                       "--format", "markdown", "--output", str(output)]
            first = subprocess.run(command, cwd=root, text=True, capture_output=True, timeout=30)
            self.assertEqual(first.returncode, 0, first.stderr)
            original = output.read_bytes()
            self.assertIn(b"Sensitivity outcomes", original)
            second = subprocess.run(command, cwd=root, text=True, capture_output=True, timeout=30)
            self.assertEqual(second.returncode, 2)
            self.assertEqual(output.read_bytes(), original)

            scenario_path = directory / "scenario.json"
            scenario_path.write_text(json.dumps(demo_scenario("normal").to_dict()), encoding="utf-8")
            protected = subprocess.run([sys.executable, "-m", "datacenter_twin", "sweep", "--scenario",
                                        str(scenario_path), "--parameter", "it_demand_kw", "--values", "900",
                                        "--output", str(scenario_path), "--force"], cwd=root, text=True,
                                       capture_output=True, timeout=30)
            self.assertEqual(protected.returncode, 2)
            self.assertEqual(json.loads(scenario_path.read_text(encoding="utf-8"))["schema_version"], 2)
