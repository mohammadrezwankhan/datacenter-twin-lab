"""Independent numerical and input-validation regression reproductions."""

from dataclasses import replace
from fractions import Fraction
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

from datacenter_twin.contracts import InputError, Scenario, Segment, load_scenario
from datacenter_twin.engine import simulate

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/scenarios/baseline-1mw.json"


class ConstructionRegressionTests(unittest.TestCase):
    def setUp(self):
        self.base = load_scenario(BASE)

    def test_direct_constructor_rejects_boolean_capacity(self):
        with self.assertRaises(InputError):
            replace(self.base, it_capacity_kw=True)

    def test_direct_constructor_preserves_tariff_precision(self):
        result = simulate(replace(self.base, tariff_per_kwh=0.123456789))
        self.assertEqual(result["assumptions"]["tariff_per_kwh"], "0.123456789")
        self.assertEqual(result["energy_only_cost"], "1351851.84")

    def test_direct_segment_constructor_validates_ratings(self):
        for patch in ({"hours": True}, {"hours": 0}, {"it_load_kw": -1}, {"assumed_pue": "0.9"}):
            with self.subTest(patch=patch), self.assertRaises(InputError):
                Segment(**{"label": "Test", "hours": 1, "it_load_kw": 100, "assumed_pue": "1.25", **patch})

    def test_direct_scenario_constructor_validates_metadata(self):
        for patch in ({"source_ids": "source"}, {"segments": "segment"}, {"currency": "GBP"},
                      {"assumption_date": "2026-02-30"}, {"tariff_per_kwh": None}):
            with self.subTest(patch=patch), self.assertRaises(InputError):
                replace(self.base, **patch)

    def test_maximum_accepted_precision_preserves_exact_energy(self):
        value = "999999999999.999999999"
        segment = {"label": "Envelope", "hours": value, "it_load_kw": value, "assumed_pue": value}
        data = {**self.base.to_dict(), "segments": [segment]}
        result = simulate(Scenario.from_dict(data))
        self.assertEqual(Fraction(result["facility_energy_kwh"]), Fraction(value) ** 3)
        self.assertEqual(Fraction(result["facility_energy_kwh"]),
                         Fraction(result["it_energy_kwh"]) + Fraction(result["non_it_energy_kwh"]))

    def test_maximum_interval_count_preserves_exact_energy(self):
        value = "999999999999.999999999"
        segment = {"label": "Envelope", "hours": value, "it_load_kw": value, "assumed_pue": value}
        result = simulate(Scenario.from_dict({**self.base.to_dict(), "segments": [segment] * 10000}))
        self.assertEqual(Fraction(result["facility_energy_kwh"]), Fraction(value) ** 3 * 10000)

    def test_direct_constructor_freezes_mutable_collections(self):
        sources, segments = ["original"], [Segment("Test", 1, 100, "1.25")]
        scenario = replace(self.base, source_ids=sources, segments=segments)
        sources.append("later")
        segments.clear()
        self.assertEqual(scenario.source_ids, ("original",))
        self.assertEqual(simulate(scenario)["facility_energy_kwh"], "125")


class InputOutputRegressionTests(unittest.TestCase):
    def command(self, *args):
        return subprocess.run([sys.executable, "-m", "datacenter_twin", *args], cwd=ROOT,
                              capture_output=True, text=True, encoding="utf-8", timeout=15)

    def test_export_never_truncates_input_through_hard_link(self):
        with TemporaryDirectory() as directory:
            source, output = Path(directory) / "source.json", Path(directory) / "alias.json"
            original = BASE.read_bytes()
            source.write_bytes(original)
            os.link(source, output)
            result = self.command("run", str(source), "--output", str(output))
            self.assertEqual(source.read_bytes(), original)
            self.assertEqual(result.returncode, 2)

    def test_existing_output_requires_explicit_force(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "existing.json"
            output.write_text("previous result", encoding="utf-8")
            result = self.command("run", str(BASE), "--output", str(output))
            self.assertEqual(output.read_text(encoding="utf-8"), "previous result")
            self.assertEqual(result.returncode, 2)
            self.assertIn("--force", result.stderr)

    def test_deep_json_is_an_input_error_without_traceback(self):
        with TemporaryDirectory() as directory:
            source = Path(directory) / "deep.json"
            source.write_text("[" * 20000 + "0" + "]" * 20000, encoding="utf-8")
            result = self.command("run", str(source))
            self.assertEqual(result.returncode, 2)
            self.assertNotIn("Traceback", result.stderr)

    def test_large_json_is_bounded_before_decoding(self):
        with TemporaryDirectory() as directory:
            source = Path(directory) / "large.json"
            source.write_bytes(BASE.read_bytes() + b" " * (4 * 1024 * 1024))
            with self.assertRaisesRegex(InputError, "4 MiB"):
                load_scenario(source)

    def test_invalid_utf8_is_an_input_error(self):
        with TemporaryDirectory() as directory:
            source = Path(directory) / "invalid.json"
            source.write_bytes(b'\xff\xff')
            result = self.command("run", str(source))
            self.assertEqual(result.returncode, 2)
            self.assertNotIn("Traceback", result.stderr)

    def test_force_replaces_cli_output(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "result.json"
            output.write_text("previous", encoding="utf-8")
            result = self.command("run", str(BASE), "--output", str(output), "--force")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('"energy_only_cost": "1095000.00"', output.read_text())

    def test_force_requires_output(self):
        result = self.command("run", str(BASE), "--force")
        self.assertEqual(result.returncode, 2)
        self.assertIn("--force requires --output", result.stderr)
