from decimal import Decimal
from fractions import Fraction
from importlib.resources import files
import json
import unittest

from datacenter_twin.continuity import simulate_continuity
from datacenter_twin.demo import FACILITY_PRESETS, FACILITY_PROFILES, PRESETS, demo_scenario


class FacilityProfileTests(unittest.TestCase):
    def test_new_assumptions_resolve_to_packaged_source_records(self):
        catalog = json.loads(
            files("datacenter_twin").joinpath("resources/catalog.json").read_text(encoding="utf-8")
        )
        source_ids = {source["id"] for source in catalog["sources"]}
        for modes in FACILITY_PRESETS.values():
            for preset in modes.values():
                with self.subTest(preset=preset):
                    scenario = demo_scenario(preset)
                    self.assertTrue(set(scenario.source_ids).issubset(source_ids))
                    if preset != "ai_cluster_generator_failure":
                        self.assertIn("SYN-ENERGY-WORKSPACE-001", scenario.source_ids)

    @staticmethod
    def fraction(value):
        return Fraction(Decimal(value))

    def assert_fraction_close(self, actual, expected):
        # Engine quantities are rendered under the stated 100-digit context.
        self.assertLess(abs(self.fraction(actual) - expected), Fraction(1, 10**90))

    def test_four_profiles_scale_power_and_finite_battery_in_units(self):
        expected_loads_mw = {
            "ai_cluster_50mw": 50,
            "hyperscale_200mw": 200,
            "crypto_30mw": 30,
            "traditional_5mw": 5,
        }
        self.assertEqual(set(FACILITY_PROFILES), set(expected_loads_mw))
        for profile_id, load_mw in expected_loads_mw.items():
            with self.subTest(profile=profile_id):
                scenario = demo_scenario(FACILITY_PRESETS[profile_id]["outage"])
                load_kw = Decimal(load_mw) * 1000
                battery_kwh = load_kw / 10  # 0.1 h gross reserve by assumption.
                self.assertEqual(scenario.it_demand_kw, load_kw)
                self.assertEqual(scenario.it_capacity_kw, load_kw)
                self.assertEqual(scenario.battery_capacity_kwh, battery_kwh)
                self.assertEqual(scenario.battery_initial_kwh, battery_kwh)
                self.assertEqual(scenario.battery_charge_kw, load_kw / 10)
                self.assertEqual(scenario.generator_start_delay_s, 30)
                self.assertEqual(
                    [asset.capacity_kw for asset in scenario.assets if asset.id == "utility"],
                    [load_kw * Decimal("1.5")],
                )
                self.assertIn(FACILITY_PROFILES[profile_id]["source_id"], scenario.source_ids)
                self.assertEqual(scenario.distribution_efficiency, Decimal("0.95"))
                self.assertEqual(scenario.battery_discharge_efficiency, Decimal("0.90"))

    def test_existing_seven_presets_stay_and_ai_default_is_the_profile_outage(self):
        old_ids = {
            "normal",
            "utility_loss",
            "generator_failure",
            "path_maintenance",
            "shared_domain",
            "ai_cluster_utility_loss",
            "ai_cluster_generator_failure",
        }
        self.assertTrue(old_ids.issubset(PRESETS))
        self.assertEqual(
            FACILITY_PRESETS["ai_cluster_50mw"]["outage"],
            "ai_cluster_generator_failure",
        )
        self.assertEqual(
            len([preset for modes in FACILITY_PRESETS.values() for preset in modes.values()]),
            12,
        )

    def test_outage_presets_have_307_8_second_ride_through_and_recover_at_900_s(self):
        for profile_id, modes in FACILITY_PRESETS.items():
            with self.subTest(profile=profile_id):
                scenario = demo_scenario(modes["outage"])
                run = simulate_continuity(scenario).to_dict()
                self.assertEqual(scenario.duration_s, 1800)
                self.assertEqual(
                    [(event.at_s, event.action, event.target) for event in scenario.events],
                    [
                        (300, "asset_down", "utility"),
                        (300, "asset_down", "generator"),
                        (900, "asset_up", "utility"),
                        (900, "asset_up", "generator"),
                    ],
                )
                self.assertEqual(
                    next(event["at_s"] for event in run["events"] if event["action"] == "battery_depleted"),
                    "607.8",
                )
                self.assertEqual(run["summary"]["unserved_duration_s"], "292.2")
                expected_unserved_kwh = Fraction(scenario.it_demand_kw) * Fraction(1461, 5) / 3600
                self.assert_fraction_close(
                    run["summary"]["unserved_it_kwh"], expected_unserved_kwh
                )

    def test_load_step_presets_are_piecewise_power_inputs_at_stated_seconds(self):
        for profile_id, modes in FACILITY_PRESETS.items():
            with self.subTest(profile=profile_id):
                scenario = demo_scenario(modes["ramp"])
                run = simulate_continuity(scenario).to_dict()
                load_kw = scenario.it_demand_kw
                self.assertEqual(scenario.duration_s, 1800)
                self.assertEqual(scenario.step_s, 10)
                self.assertEqual(scenario.it_capacity_kw, load_kw * Decimal("1.1"))
                self.assertEqual(
                    [(event.at_s, event.action, Decimal(event.value_kw)) for event in scenario.events],
                    [
                        (300, "set_demand", load_kw * Decimal("0.8")),
                        (600, "set_demand", load_kw * Decimal("1.1")),
                        (900, "set_demand", load_kw),
                    ],
                )
                # Hand integrate 300 s @100%, 300 s @80%, 300 s @110%, 900 s @100%.
                expected_requested_kwh = Fraction(load_kw) * Fraction(1770, 3600)
                self.assert_fraction_close(
                    run["summary"]["requested_it_kwh"], expected_requested_kwh
                )
                self.assertEqual(run["summary"]["unserved_it_kwh"], "0")
                self.assertEqual(run["summary"]["unserved_duration_s"], "0")
                self.assertLessEqual(run["summary"]["interval_count"], 185)

    def test_extended_reserve_bridges_three_hours_and_half_reserve_depletes_by_hand_math(self):
        for profile_id, modes in FACILITY_PRESETS.items():
            with self.subTest(profile=profile_id):
                scenario = demo_scenario(modes["reserve"])
                run = simulate_continuity(scenario).to_dict()
                load_kw = scenario.it_demand_kw
                self.assertEqual(scenario.duration_s, 14_400)
                self.assertEqual(scenario.step_s, 60)
                self.assertEqual(len(scenario.events), 4)
                self.assertEqual(
                    [event.at_s for event in scenario.events], [300, 300, 11_100, 11_100]
                )
                self.assertEqual(scenario.battery_initial_kwh, load_kw * 4)
                self.assertEqual(scenario.battery_capacity_kwh, load_kw * 4)
                self.assertEqual(scenario.battery_charge_kw, 0)
                self.assertNotIn(
                    "battery_depleted", [event["action"] for event in run["events"]]
                )
                self.assertEqual(run["summary"]["unserved_duration_s"], "0")
                self.assertEqual(run["summary"]["unserved_it_kwh"], "0")
                # 4 h opening energy less 3 h / (0.90 × 0.95) discharge loss.
                expected_final_kwh = Fraction(load_kw) * Fraction(28, 57)
                self.assert_fraction_close(
                    run["summary"]["battery_final_kwh"], expected_final_kwh
                )
                self.assertLessEqual(run["summary"]["interval_count"], 245)

                # 3 h / (0.90 discharge × 0.95 distribution) uses 200/57 h gross.
                half_reserve = scenario.__class__.from_dict(
                    {
                        **scenario.to_dict(),
                        "battery_initial_kwh": str(scenario.battery_capacity_kwh / 2),
                    }
                )
                half_run = simulate_continuity(half_reserve).to_dict()
                depletion = next(
                    event["at_s"]
                    for event in half_run["events"]
                    if event["action"] == "battery_depleted"
                )
                self.assertEqual(depletion, "6456")  # 300 s + 1.71 h × 3600.
                self.assertEqual(half_run["summary"]["unserved_duration_s"], "4644")
                self.assertEqual(
                    Fraction(half_run["summary"]["unserved_duration_s"]),
                    Fraction(129, 100) * 3600,
                )
                expected_unserved_kwh = Fraction(load_kw) * Fraction(4644, 3600)
                self.assert_fraction_close(
                    half_run["summary"]["unserved_it_kwh"], expected_unserved_kwh
                )
                self.assertEqual(half_run["summary"]["battery_final_kwh"], "0")


if __name__ == "__main__":
    unittest.main()
