"""Numerical checks for the user-supplied research-study adaptations."""

from __future__ import annotations

import json
import unittest

try:
    import numpy  # noqa: F401
    import scipy  # noqa: F401

    _NUMERICS_AVAILABLE = True
except ImportError:
    _NUMERICS_AVAILABLE = False


@unittest.skipUnless(_NUMERICS_AVAILABLE, "research studies require the optional NumPy/SciPy stack")
class ResearchStudyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from datacenter_twin.research import STUDY_DEFAULTS, run_study

        cls.defaults = STUDY_DEFAULTS
        cls.run_study = staticmethod(run_study)
        cls.results = {study_id: run_study(study_id, {}) for study_id in STUDY_DEFAULTS}

    def test_five_defaults_return_complete_finite_json_contracts(self):
        self.assertEqual(
            set(self.results),
            {"load-step", "modal", "forced-response", "model-comparison", "grid-network"},
        )
        for study_id, result in self.results.items():
            with self.subTest(study=study_id):
                self.assertEqual(result["study_id"], study_id)
                self.assertIsInstance(result["model"], str)
                self.assertTrue(result["solver"])
                self.assertTrue(result["assumptions"])
                self.assertTrue(result["metrics"])
                self.assertTrue(result["charts"])
                self.assertTrue(result["diagnostics"])
                for chart in result["charts"]:
                    self.assertIn("(", chart["x_label"])
                    self.assertIn("(", chart["y_label"])
                    self.assertTrue(chart["x"])
                    for line in chart["lines"]:
                        self.assertEqual(len(line["values"]), len(chart["x"]))
                # Independent strict JSON serialization detects NaN/Infinity
                # and accidental NumPy scalars that the browser cannot encode.
                encoded = json.dumps(result, allow_nan=False, separators=(",", ":"))
                self.assertTrue(encoded)

    def test_sdcib_equilibria_are_recomputed_and_modal_residuals_are_small(self):
        for study_id in ("load-step", "modal", "forced-response"):
            with self.subTest(study=study_id):
                result = self.results[study_id]
                self.assertLess(result["diagnostics"]["equilibrium_residual_inf"], 1e-6)
        modal = self.results["modal"]
        scale = max(1.0, modal["metrics"][0]["value"])
        self.assertLess(modal["diagnostics"]["left_eigenvector_residual_inf"], 1e-5 * scale)
        self.assertLess(modal["diagnostics"]["right_eigenvector_residual_inf"], 1e-5 * scale)
        keys = [(round(m["real"], 8), round(m["imag"], 8)) for m in modal["modes"]]
        self.assertEqual(keys, sorted(keys))
        self.assertEqual(len(modal["charts"][0]["x"]), 160)

    def test_synthetic_fft_recovers_an_independent_known_input(self):
        result = self.results["forced-response"]
        metrics = {m["label"]: m["value"] for m in result["metrics"]}
        self.assertAlmostEqual(metrics["Synthetic input frequency"], 5.0, places=12)
        self.assertAlmostEqual(
            metrics["Input FFT amplitude at nearest frequency bin"], 0.03, delta=0.001
        )
        self.assertLess(abs(metrics["Sampled output-spectrum peak frequency"] - 5.0), 0.6)
        self.assertEqual(len(result["charts"][0]["x"]), 801)
        self.assertEqual(len(result["charts"][1]["x"]), 401)
        self.assertTrue(
            any(
                "not an uploaded, measured, or GPU workload trace" in a
                for a in result["assumptions"]
            )
        )

    def test_model_pair_uses_supplied_startup_and_short_lesson_window(self):
        result = self.results["model-comparison"]
        diagnostics = result["diagnostics"]
        self.assertEqual(diagnostics["state_count"], 62)
        self.assertEqual(diagnostics["source_step_time_s"], 1.025)
        self.assertEqual(diagnostics["step_time_s"], 0.04)
        self.assertEqual(diagnostics["end_time_s"], 0.08)
        self.assertEqual(diagnostics["sample_count"], 221)
        self.assertEqual(diagnostics["post_step_sample_count"], 101)
        self.assertGreater(diagnostics["initial_derivative_inf"], 100.0)
        metrics = {m["label"]: m["value"] for m in result["metrics"]}
        self.assertGreater(
            metrics["Full-abc PCC power vs reduced-uv PCC power RMS difference after step"], 0.0
        )
        self.assertTrue(any("not a solved joint equilibrium" in a for a in result["assumptions"]))

    def test_model_comparison_states_and_outputs_converge_to_refined_bdf(self):
        import numpy as np

        from datacenter_twin.research.model_comparison import run_model_comparison

        production = {0.6: self.results["model-comparison"]}
        for load in (0.5, 0.55):
            production[load] = self.run_study("model-comparison", {"load_final_pu": load})
        for load in (0.5, 0.55, 0.6):
            with self.subTest(load_final_pu=load):
                refined = run_model_comparison({"load_final_pu": load}, rtol=1e-10, atol=1e-12)
                coarse = production[load]
                self.assertEqual(coarse["solver"]["rtol"], 1e-8)
                self.assertEqual(coarse["solver"]["atol"], 1e-10)
                coarse_state = np.asarray(coarse["diagnostics"]["final_state"])
                refined_state = np.asarray(refined["diagnostics"]["final_state"])
                scaled_state_error = np.abs(coarse_state - refined_state) / np.maximum(
                    1.0, np.abs(refined_state)
                )
                self.assertLess(float(np.max(scaled_state_error)), 2e-6)
                coarse_outputs = np.concatenate(
                    [
                        np.asarray(line["values"])
                        for chart in coarse["charts"]
                        for line in chart["lines"]
                    ]
                )
                refined_outputs = np.concatenate(
                    [
                        np.asarray(line["values"])
                        for chart in refined["charts"]
                        for line in chart["lines"]
                    ]
                )
                self.assertLess(float(np.max(np.abs(coarse_outputs - refined_outputs))), 2e-6)

    def test_grid_network_recomputes_power_flow_devices_and_schur_feedthrough(self):
        result = self.results["grid-network"]
        metrics = {m["label"]: m["value"] for m in result["metrics"]}
        self.assertLess(metrics["Recomputed power-flow mismatch infinity norm"], 1e-8)
        self.assertLess(
            metrics["Recomputed network algebraic current residual infinity norm"], 1e-8
        )
        for residual in result["diagnostics"]["device_initialization_residuals_inf"].values():
            self.assertLess(residual, 1e-5)
        self.assertLess(result["diagnostics"]["schur_feedthrough_fd_relative_error"], 1e-4)
        keys = [(round(m["real"], 8), round(m["imag"], 8)) for m in result["modes"]]
        self.assertEqual(keys, sorted(keys))
        self.assertEqual(len(result["charts"][0]["x"]), 160)
        self.assertEqual(len(result["charts"][0]["lines"]), 4)

    def test_inputs_are_strictly_bounded_and_decimal_numbers_are_supported(self):
        from decimal import Decimal

        result = self.run_study("modal", {"load_pu": Decimal("0.55")})
        self.assertEqual(result["config"]["load_pu"], 0.55)
        for config in (
            {"load_pu": 0.299},
            {"load_pu": float("nan")},
            {"load_pu": True},
            {"load_pu": 0.5, "unknown": 1.0},
        ):
            with self.subTest(config=config), self.assertRaises(ValueError):
                self.run_study("modal", config)
        with self.assertRaises(ValueError):
            self.run_study("load-step", {"load_initial_pu": 0.7, "load_final_pu": 0.4})
        for load in (0.61, 0.7):
            with self.subTest(model_comparison_load_final_pu=load), self.assertRaises(ValueError):
                self.run_study("model-comparison", {"load_final_pu": load})


if __name__ == "__main__":
    unittest.main()
