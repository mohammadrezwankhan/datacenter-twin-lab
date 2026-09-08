from copy import deepcopy
from decimal import Decimal, localcontext
from pathlib import Path
import unittest

from datacenter_twin.calculations import battery_runtime_hours, node_charge, steady_heat_kw, token_charge
from datacenter_twin.contracts import InputError, Scenario, load_scenario
from datacenter_twin.engine import compare, simulate

ROOT = Path(__file__).resolve().parents[1]


class NumericalTests(unittest.TestCase):
    def setUp(self):
        self.base = load_scenario(ROOT / "data/scenarios/baseline-1mw.json")
        self.alternative = load_scenario(ROOT / "data/scenarios/alternative-pue-115.json")

    def changed(self, **changes):
        return Scenario.from_dict({**self.base.to_dict(), **changes})

    def test_constant_load_energy_and_cost_fixture(self):
        result = simulate(self.base)
        self.assertEqual(result["facility_energy_kwh"], "10950000")
        self.assertEqual(result["it_energy_kwh"], "8760000")
        self.assertEqual(result["energy_only_cost"], "1095000.00")

    def test_lower_assumed_pue_and_comparison_fixture(self):
        result = compare(self.base, self.alternative)
        self.assertEqual(result["alternative"]["facility_energy_kwh"], "10074000")
        self.assertEqual(result["facility_energy_saving_kwh"], "876000")
        self.assertEqual(result["energy_only_cost_saving"], "87600.00")

    def test_node_billing_does_not_multiply_by_gpu_count(self):
        bill = node_charge(100, 24, 8)
        self.assertEqual(bill["cost"], Decimal(2400))
        self.assertEqual(bill["provisioned_gpu_hour_rate"], Decimal(3))
        self.assertEqual(node_charge("0.5", 24, 8)["cost"], Decimal(12))

    def test_token_billing_fixture(self):
        self.assertEqual(token_charge(5000000, 1000000, 2, 8), Decimal(18))

    def test_finite_deliverable_battery_energy_fixture(self):
        self.assertEqual(battery_runtime_hours(500, 1000), Decimal("0.5"))
        self.assertEqual(battery_runtime_hours(0, 1000), Decimal(0))
        self.assertIsNone(battery_runtime_hours(500, 0))

    def test_steady_heat_fixture(self):
        self.assertEqual(steady_heat_kw(10, "4.18", 10), Decimal(418))

    def test_zero_and_empty_it_energy_have_undefined_pue(self):
        cases = [[], [{"label": "No demand", "hours": "1", "it_load_kw": "0", "assumed_pue": "1.25"}]]
        for segments in cases:
            with self.subTest(segments=segments):
                result = simulate(self.changed(segments=segments))
                self.assertIsNone(result["period_pue"])
                self.assertEqual(result["facility_energy_kwh"], "0")
                self.assertEqual(result["energy_only_cost"], "0.00")

    def test_unknown_prices_propagate(self):
        unknown = self.changed(tariff_per_kwh=None, price_status="unknown")
        self.assertIsNone(simulate(unknown)["energy_only_cost"])
        self.assertIsNone(compare(self.base, unknown)["energy_only_cost_saving"])
        self.assertIsNone(node_charge(100, None, 8)["cost"])
        self.assertIsNone(token_charge(100, 200, None, 8))

    def test_period_pue_uses_energy_weighting(self):
        segments = [
            {"label": "A", "hours": "1", "it_load_kw": "100", "assumed_pue": "2"},
            {"label": "B", "hours": "3", "it_load_kw": "300", "assumed_pue": "1"},
        ]
        result = simulate(self.changed(segments=segments))
        self.assertEqual(result["period_pue"], "1.1")
        self.assertEqual(result["facility_energy_kwh"], "1100")

    def test_energy_ledger_reconciles_without_double_counting(self):
        for scenario_file in (ROOT / "data/scenarios").glob("*.json"):
            with self.subTest(path=scenario_file.name):
                result = simulate(load_scenario(scenario_file))
                self.assertEqual(Decimal(result["facility_energy_kwh"]),
                                 Decimal(result["it_energy_kwh"]) + Decimal(result["non_it_energy_kwh"]))

    def test_changed_demand_changes_energy_cost_and_capacity_screen(self):
        data = deepcopy(self.base.to_dict())
        data["segments"][0]["it_load_kw"] = "2000"
        result = simulate(Scenario.from_dict(data))
        self.assertEqual(result["facility_energy_kwh"], "21900000")
        self.assertEqual(result["energy_only_cost"], "2190000.00")
        self.assertEqual(result["capacity_screen"], "exceeds_envelope")
        self.assertEqual(result["it_capacity_margin_kw"], "-1000")

    def test_replay_and_decimal_context_are_stable(self):
        expected = simulate(self.base)
        with localcontext() as context:
            context.prec = 5
            self.assertEqual(simulate(self.base), expected)
            self.assertEqual(compare(self.base, self.alternative)["energy_only_cost_saving"], "87600.00")
        self.assertNotEqual(expected["run_id"], simulate(self.alternative)["run_id"])

    def test_round_money_once_after_aggregation_half_even(self):
        segments = [{"label": str(i), "hours": "1", "it_load_kw": "1", "assumed_pue": "1"}
                    for i in range(3)]
        result = simulate(self.changed(tariff_per_kwh="0.005", segments=segments))
        self.assertEqual(result["energy_only_cost"], "0.02")

    def test_compare_rejects_different_currency_or_workload(self):
        with self.assertRaisesRegex(InputError, "same currency"):
            compare(self.base, self.changed(currency="EUR"))
        with self.assertRaisesRegex(InputError, "identical interval"):
            compare(self.base, self.changed(segments=[]))

    def test_invalid_arithmetic_inputs(self):
        for fn, args in ((node_charge, (100, -1, 8)), (node_charge, (100, 24, True)),
                         (token_charge, ("1.5", 2, 2, 8)), (battery_runtime_hours, (-1, 10)),
                         (steady_heat_kw, (10, 0, 10))):
            with self.subTest(fn=fn.__name__, args=args), self.assertRaises(InputError):
                fn(*args)


if __name__ == "__main__":
    unittest.main()
