"""Independent circuit expectations for the bounded EMT teaching study."""

import math
import unittest

from datacenter_twin.contracts import InputError
from datacenter_twin.emt import DEFAULT_EMT, EMT_PRESETS, simulate_emt


def analytic_segment(config, state, supply, seconds):
    """Closed-form exp(A*t) for an underdamped constant-input segment.

    This has no RK stepping or energy quadrature shared with the solver.
    """
    resistance, load = config["resistance_ohm"], config["load_ohm"]
    inductance, capacitance = config["inductance_mh"] / 1000, config["capacitance_mf"] / 1000
    a, b = -resistance / inductance, -1 / inductance
    c, d = 1 / capacitance, -1 / (load * capacitance)
    alpha = (a + d) / 2
    omega = math.sqrt(-(((a - d) / 2) ** 2 + b * c))
    equilibrium = (supply / (resistance + load), supply * load / (resistance + load))
    x, y = (state[i] - equilibrium[i] for i in (0, 1))
    decay, cosine, sine = (
        math.exp(alpha * seconds),
        math.cos(omega * seconds),
        math.sin(omega * seconds) / omega,
    )
    return (
        equilibrium[0] + decay * (cosine * x + sine * ((a - alpha) * x + b * y)),
        equilibrium[1] + decay * (cosine * y + sine * (c * x + (d - alpha) * y)),
    )


class EmtCircuitTests(unittest.TestCase):
    def test_dc_divider_and_no_event_steady_state(self):
        result = simulate_emt({**DEFAULT_EMT, "sag_pu": 1})
        current = 800 / (0.08 + 12.8)
        voltage = 12.8 * current
        for row in result["rows"]:
            self.assertAlmostEqual(row["bus_v"], voltage, places=10)
            self.assertAlmostEqual(row["source_a"], current, places=10)
        self.assertAlmostEqual(
            result["summary"]["load_energy_j"], voltage**2 / 12.8 * 0.2, places=6
        )

    def test_both_events_against_analytic_segment_solution(self):
        result = simulate_emt()
        config = result["config"]
        initial = (800 / 12.88, 800 * 12.8 / 12.88)
        dip_end = analytic_segment(config, initial, 400, 0.08)
        for time_ms in (40, 42, 50, 80, 119.9, 120, 122, 150, 200):
            if time_ms <= 120:
                expected = analytic_segment(config, initial, 400, (time_ms - 40) / 1000)
            else:
                expected = analytic_segment(config, dip_end, 800, (time_ms - 120) / 1000)
            row = result["rows"][round(time_ms * 10)]
            self.assertAlmostEqual(row["source_a"], expected[0], delta=0.00001)
            self.assertAlmostEqual(row["bus_v"], expected[1], delta=0.00001)

    def test_event_is_right_continuous_but_state_cannot_jump(self):
        rows = simulate_emt()["rows"]
        self.assertEqual(rows[399]["source_v"], 800)
        self.assertEqual(rows[400]["source_v"], 400)
        self.assertEqual(rows[1200]["source_v"], 800)
        self.assertAlmostEqual(rows[399]["bus_v"], rows[400]["bus_v"], places=10)
        self.assertAlmostEqual(rows[399]["source_a"], rows[400]["source_a"], places=10)

    def test_fourth_order_refinement_vs_closed_form(self):
        config = dict(DEFAULT_EMT)
        expected = analytic_segment(config, (800 / 12.88, 800 * 12.8 / 12.88), 400, 0.0037)[1]
        errors = []
        for step in (50, 25):
            value = simulate_emt({**config, "step_us": step})["rows"][437]["bus_v"]
            errors.append(abs(value - expected))
        self.assertGreater(errors[0] / errors[1], 12)
        self.assertLess(errors[0] / errors[1], 20)

    def test_energy_ledger_including_reverse_source_flow(self):
        for name, config in EMT_PRESETS.items():
            with self.subTest(name=name):
                result = simulate_emt(config)
                summary = result["summary"]
                self.assertLess(abs(summary["balance_error_j"]), 0.001)
                self.assertGreaterEqual(summary["resistor_loss_j"], 0)
                self.assertGreaterEqual(summary["load_energy_j"], 0)
                self.assertTrue(any(row["source_a"] < 0 for row in result["rows"]))
                self.assertEqual(len(result["rows"]), 2001)

    def test_allowed_corner_configurations_remain_finite(self):
        for resistance in (0.02, 1):
            for inductance in (0.1, 5):
                for capacitance in (1, 50):
                    result = simulate_emt(
                        {
                            **DEFAULT_EMT,
                            "resistance_ohm": resistance,
                            "inductance_mh": inductance,
                            "capacitance_mf": capacitance,
                            "step_us": 50,
                            "sag_pu": 0.1,
                            "load_ohm": 2,
                        }
                    )
                    self.assertTrue(all(math.isfinite(v) for v in result["summary"].values()))

    def test_reject_invalid_or_ambiguous_inputs(self):
        for field, value in [
            ("step_us", 15),
            ("step_us", True),
            ("sag_start_ms", 40.5),
            ("sag_pu", float("nan")),
            ("capacitance_mf", 0),
            ("source_v", "800"),
            ("load_ohm", float("inf")),
        ]:
            with self.subTest(field=field, value=value), self.assertRaises(InputError):
                simulate_emt({**DEFAULT_EMT, field: value})
        for value in ([], {}, {**DEFAULT_EMT, "extra": 1}):
            with self.assertRaises(InputError):
                simulate_emt(value)


if __name__ == "__main__":
    unittest.main()
