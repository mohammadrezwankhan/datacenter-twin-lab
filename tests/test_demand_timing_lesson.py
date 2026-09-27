"""Check the tutorial's distinct energy/timing claim against exact expectations."""

from fractions import Fraction
import unittest

from datacenter_twin.continuity import simulate_continuity
from scripts.reproduce_demand_timing import CASES, load_case, verify_case


class DemandTimingLessonTests(unittest.TestCase):
    def test_only_the_timing_of_demand_changes_between_cases(self):
        shared_inputs = []
        for name in CASES:
            data = load_case(name).to_dict()
            for field in ("id", "name", "it_demand_kw"):
                del data[field]
            data["events"] = [event for event in data["events"] if event["action"] != "set_demand"]
            shared_inputs.append(data)
        self.assertEqual(shared_inputs[0], shared_inputs[1])
        self.assertEqual(shared_inputs[0], shared_inputs[2])
        self.assertEqual(shared_inputs[0]["battery_charge_kw"], "0")
        self.assertEqual(shared_inputs[0]["battery_initial_kwh"], "100")

    def test_three_equal_energy_profiles_have_the_hand_calculated_outcomes(self):
        for name in CASES:
            with self.subTest(case=name):
                result = simulate_continuity(load_case(name)).to_dict()
                verify_case(name, result)
                restored = next(row for row in result["intervals"] if row["start_s"] == "900")
                self.assertEqual(restored["served_it_kw"], "500" if name == "early-peak" else "1000")

    def test_their_input_schedules_each_integrate_to_375_kwh(self):
        for name in CASES:
            scenario = load_case(name)
            demand = Fraction(scenario.it_demand_kw)
            previous = 0
            energy = Fraction(0)
            changes = sorted((event for event in scenario.events if event.action == "set_demand"),
                             key=lambda event: event.at_s)
            for event in changes:
                energy += demand * (event.at_s - previous) / 3600
                demand, previous = Fraction(event.value_kw), event.at_s
            energy += demand * (scenario.duration_s - previous) / 3600
            self.assertEqual(energy, 375, name)


if __name__ == "__main__":
    unittest.main()
