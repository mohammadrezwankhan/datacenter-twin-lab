from copy import deepcopy
from dataclasses import replace
from decimal import Decimal, localcontext
from fractions import Fraction as F
import unittest

from datacenter_twin.continuity import FlowNetwork, simulate_continuity
from datacenter_twin.contracts import InputError
from datacenter_twin.demo import PRESETS, demo_scenario
from datacenter_twin.topology import Asset, Dependency, Event, SiteScenario


class TopologyTests(unittest.TestCase):
    def setUp(self): self.data = demo_scenario("normal").to_dict()

    def test_round_trip(self):
        original = SiteScenario.from_dict(self.data)
        self.assertEqual(SiteScenario.from_dict(original.to_dict()), original)

    def test_unique_ids_and_reference_integrity(self):
        for alteration in ("duplicate", "missing", "cycle", "charges", "source_path"):
            data = deepcopy(self.data)
            if alteration == "duplicate": data["assets"][1]["id"] = "utility"
            elif alteration == "missing": data["dependencies"][0]["target"] = "missing"
            elif alteration == "cycle": data["dependencies"].append({"source":"it-bus","target":"main-bus","relation":"feeds"})
            elif alteration == "charges": data["dependencies"] = [edge for edge in data["dependencies"] if edge["relation"] != "charges"]
            else: data["dependencies"] = [edge for edge in data["dependencies"] if edge["source"] != "generator"]
            with self.subTest(alteration=alteration), self.assertRaises(InputError): SiteScenario.from_dict(data)

    def test_units_bounds_and_invalid_metadata(self):
        for values in ({"distribution_efficiency":"1.01"}, {"battery_initial_kwh":"101"},
                       {"duration_s":True}, {"duration_s":86400,"step_s":1}, {"schema_version":1},
                       {"tariff_per_kwh":"NaN"}, {"it_demand_kw":-1}, {"currency":"GBP"}):
            with self.subTest(values=values), self.assertRaises(InputError): SiteScenario.from_dict({**self.data, **values})
        self.data["assets"][0]["capacity_kva"] = 1500
        with self.assertRaises(InputError): SiteScenario.from_dict(self.data)

    def test_event_targets_and_end_boundary(self):
        for event in (Event(0,"asset_down","missing",None), Event(1800,"asset_down","utility",None),
                      Event(0,"set_demand","battery",10)):
            with self.subTest(event=event), self.assertRaises(InputError): replace(demo_scenario(), events=(event,))

    def test_requires_cycle_is_rejected(self):
        base = demo_scenario()
        edges = base.dependencies + (Dependency("path-a","path-b","requires"), Dependency("path-b","path-a","requires"))
        with self.assertRaisesRegex(InputError,"requires cycle"): replace(base, dependencies=edges)

    def test_charging_path_and_battery_power_limits(self):
        base = demo_scenario()
        with self.assertRaisesRegex(InputError,"electrical power rating"):
            replace(base, battery_charge_kw=1201)
        bus = Asset("isolated", "Isolated bus", "bus", 100, ("isolated",), ("test",))
        edges = tuple(Dependency("isolated","battery","charges") if e.relation == "charges" else e for e in base.dependencies)
        with self.assertRaisesRegex(InputError,"charging bus"):
            replace(base, assets=base.assets+(bus,), dependencies=edges)


class ContinuityTests(unittest.TestCase):
    def run_case(self, preset="normal", **changes):
        return simulate_continuity(replace(demo_scenario(preset), **changes)).to_dict()

    def test_normal_operation_has_independent_energy_expectations(self):
        run = self.run_case(distribution_efficiency=1)
        self.assertEqual(run["summary"]["served_it_kwh"], "500")
        self.assertEqual(run["summary"]["grid_kwh"], "500")
        self.assertEqual(run["summary"]["grid_energy_charge"], "50.00")
        self.assertEqual(run["summary"]["unserved_it_kwh"], "0")

    def test_generator_delay_is_split_inside_regular_timestep(self):
        run = self.run_case("utility_loss", generator_start_delay_s=37, step_s=60)
        self.assertTrue(any(row["end_s"] == "337" for row in run["intervals"]))
        at300 = next(row for row in run["intervals"] if row["start_s"] == "300")
        at337 = next(row for row in run["intervals"] if row["start_s"] == "337")
        self.assertEqual(at300["asset_states"]["generator"], "starting")
        self.assertGreater(F(at300["battery_discharge_kw"]), 0)
        self.assertEqual(at337["asset_states"]["generator"], "running")
        self.assertEqual(at337["battery_discharge_kw"], "0")
        self.assertEqual(run["summary"]["unserved_it_kwh"], "0")

    def test_failure_battery_depletes_exactly_and_utility_restores_service(self):
        run = self.run_case("generator_failure", distribution_efficiency=1, battery_discharge_efficiency=1)
        depletion = next(event for event in run["events"] if event["action"] == "battery_depleted")
        self.assertEqual(depletion["at_s"], "660") # 100 kWh / 1000 kW = 360 s after loss
        self.assertEqual(run["summary"]["unserved_duration_s"], "240")
        restored = next(row for row in run["intervals"] if row["start_s"] == "900")
        self.assertEqual(restored["served_it_kw"], "1000")
        self.assertGreater(F(restored["battery_charge_kw"]), 0)

    def test_surviving_path_overload_limits_delivered_power(self):
        run = self.run_case("path_maintenance")
        row = next(row for row in run["intervals"] if row["start_s"] == "300")
        self.assertEqual(row["served_it_kw"], "665") # 700 gross kW × 0.95
        self.assertEqual(row["unserved_it_kw"], "335")
        self.assertIn("UNSERVED_IT_LOAD", row["warnings"])

    def test_shared_domain_takes_down_both_paths(self):
        run = self.run_case("shared_domain")
        row = next(row for row in run["intervals"] if row["start_s"] == "300")
        self.assertEqual(row["served_it_kw"], "0")
        self.assertEqual(row["asset_states"]["path-a"], "unavailable")
        self.assertEqual(row["asset_states"]["path-b"], "unavailable")

    def test_requires_dependencies_propagate_unavailability(self):
        base = demo_scenario("normal")
        run = simulate_continuity(replace(base, dependencies=base.dependencies+(Dependency("path-a","path-b","requires"),),
                                         events=(Event(0,"asset_down","path-a",None),))).to_dict()
        self.assertEqual(run["intervals"][0]["served_it_kw"], "0")

    def test_charging_uses_only_spare_grid_power(self):
        base = demo_scenario("normal")
        assets = tuple(replace(a,capacity_kw=1000) if a.kind == "utility" else a for a in base.assets)
        run = simulate_continuity(replace(base, assets=assets, distribution_efficiency=1, battery_initial_kwh=50)).to_dict()
        self.assertEqual(run["summary"]["battery_final_kwh"], "50")
        self.assertTrue(all(row["battery_charge_kw"] == "0" for row in run["intervals"]))

    def test_charging_stops_at_full_energy(self):
        run = self.run_case(battery_initial_kwh=99, battery_charge_efficiency=1, step_s=60)
        self.assertEqual(run["intervals"][0]["end_s"], "36")
        self.assertEqual(run["summary"]["battery_final_kwh"], "100")
        self.assertTrue(all(row["battery_charge_kw"] == "0" for row in run["intervals"][1:]))

    def test_energy_balance_all_presets_and_battery_bounds(self):
        for preset in PRESETS:
            run = self.run_case(preset)
            for row in run["intervals"]:
                with self.subTest(preset=preset, at=row["start_s"]):
                    energy = {key:F(value) for key,value in row["energy"].items()}
                    self.assertLess(abs(energy["requested_it_kwh"]-energy["served_it_kwh"]-energy["unserved_it_kwh"]), F(1,10**80))
                    self.assertEqual(row["energy_balance_residual_kwh"], "0")
                    # Independently reconstruct the boundary from exported terms, not its residual field.
                    incoming = energy["grid_kwh"] + energy["generator_kwh"]
                    accounted = sum(energy[key] for key in ("served_it_kwh", "battery_stored_change_kwh",
                        "distribution_loss_kwh", "battery_charge_loss_kwh", "battery_discharge_loss_kwh"))
                    self.assertLess(abs(incoming-accounted), F(1,10**80))
                    self.assertLess(abs(F(row["battery_end_kwh"])-F(row["battery_start_kwh"])-energy["battery_stored_change_kwh"]), F(1,10**80))
                    self.assertTrue(0 <= F(row["battery_end_kwh"]) <= 100)
            self.assertEqual(run["summary"]["energy_balance_residual_kwh"], "0")

    def test_unknown_generator_cost_is_not_free(self):
        run = self.run_case("utility_loss")
        self.assertIsNone(run["summary"]["total_incremental_energy_charge"])
        self.assertIsNotNone(run["summary"]["grid_energy_charge"])
        self.assertEqual(self.run_case()["summary"]["cost_status"], "illustrative")

    def test_deterministic_replay_and_context_independence(self):
        scenario = demo_scenario("generator_failure")
        first = simulate_continuity(scenario).to_dict()
        with localcontext() as context:
            context.prec = 6
            self.assertEqual(first, simulate_continuity(scenario).to_dict())
        self.assertNotEqual(first["run_id"], self.run_case()["run_id"])

    def test_stable_simultaneous_event_order_and_demand_changes(self):
        events = (Event(10,"asset_down","utility",None), Event(10,"asset_up","utility",None),
                  Event(10,"set_demand","it-load",500))
        run = self.run_case(events=events)
        row = next(row for row in run["intervals"] if row["start_s"] == "10")
        self.assertEqual(row["requested_it_kw"], "500")
        self.assertEqual(row["asset_states"]["utility"], "available")

    def test_zero_load_no_cost_or_battery_discharge(self):
        run = self.run_case(it_demand_kw=0)
        self.assertEqual(run["summary"]["grid_energy_charge"], "0.00")
        self.assertEqual(run["summary"]["battery_final_kwh"], "100")

    def test_residual_network_reroutes_to_avoid_greedy_path_failure(self):
        network = FlowNetwork()
        for a,b,capacity in [("SOURCE","a",1),("SOURCE","b",1),("a","c",1),("a","d",1),("b","c",1),("c","SINK",1),("d","SINK",1)]:
            network.add(a,b,F(capacity))
        network.augment()
        self.assertEqual(network.flow("c","SINK")+network.flow("d","SINK"),2)
