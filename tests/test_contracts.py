from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from datacenter_twin.contracts import InputError, Scenario, load_scenario
from datacenter_twin.engine import simulate

ROOT = Path(__file__).resolve().parents[1]


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.data = load_scenario(ROOT / "data/scenarios/baseline-1mw.json").to_dict()

    def test_round_trip(self):
        scenario = Scenario.from_dict(self.data)
        self.assertEqual(Scenario.from_dict(scenario.to_dict()), scenario)

    def test_bad_numbers_are_rejected(self):
        for value in (-1, True, "NaN", "Infinity", "", None, [], "1e13", "0.0000000001"):
            with self.subTest(value=value), self.assertRaises(InputError):
                Scenario.from_dict({**self.data, "tariff_per_kwh": value})

    def test_missing_and_unknown_fields_are_rejected(self):
        del self.data["currency"]
        with self.assertRaisesRegex(InputError, "missing fields"):
            Scenario.from_dict(self.data)
        self.data["currency"] = "USD"
        self.data["cooling_energy_kwh"] = 100
        with self.assertRaisesRegex(InputError, "unknown fields"):
            Scenario.from_dict(self.data)

    def test_price_status_and_date_are_required(self):
        for patch in ({"tariff_per_kwh": None}, {"price_status": "unknown"},
                      {"assumption_date": "2026-02-30"}, {"assumption_date": "20260908"},
                      {"currency": "GBP"}, {"schema_version": True}, {"source_ids": []}):
            with self.subTest(patch=patch), self.assertRaises(InputError):
                Scenario.from_dict({**self.data, **patch})

    def test_physical_domain_and_interval_bounds(self):
        for field, value in (("assumed_pue", "0.9"), ("it_load_kw", "-1"), ("hours", "0")):
            self.data["segments"][0] = {"label": "Test", "hours": "1", "it_load_kw": "1", "assumed_pue": "1.25"}
            self.data["segments"][0][field] = value
            with self.subTest(field=field), self.assertRaises(InputError):
                Scenario.from_dict(self.data)

    def test_duplicate_json_keys_are_rejected(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text('{"schema_version":1,"schema_version":2}', encoding="utf-8")
            with self.assertRaisesRegex(InputError, "Duplicate"):
                load_scenario(path)

    def test_equivalent_numeric_text_has_same_input_hash(self):
        original = simulate(Scenario.from_dict(self.data))
        self.data["tariff_per_kwh"] = "0.1000"
        equivalent = simulate(Scenario.from_dict(self.data))
        self.assertEqual(original["input_sha256"], equivalent["input_sha256"])

    def test_zero_price_is_distinct_from_missing_price(self):
        zero = simulate(Scenario.from_dict({**self.data, "tariff_per_kwh": "0"}))
        unknown = simulate(Scenario.from_dict({**self.data, "tariff_per_kwh": None, "price_status": "unknown"}))
        self.assertEqual(zero["energy_only_cost"], "0.00")
        self.assertIsNone(unknown["energy_only_cost"])
