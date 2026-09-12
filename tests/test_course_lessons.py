"""Independent native expectations for the twelve browser course lessons."""

from dataclasses import replace
from fractions import Fraction
import unittest

from datacenter_twin.continuity import simulate_continuity
from datacenter_twin.contracts import Scenario
from datacenter_twin.demo import demo_scenario
from datacenter_twin.engine import simulate
from datacenter_twin.topology import Event




LESSON_CASES = (
    {
        "id": "power-energy",
        "preset": "normal",
        "field": "it_demand_kw",
        "initial": "1000",
        "challenge": "500",
        "result_key": "requested_it_kwh",
        "expected_initial": "500",
        "expected_challenge": "250",
    },
    {
        "id": "distribution-loss",
        "preset": "normal",
        "field": "distribution_efficiency",
        "initial": "0.95",
        "challenge": "0.90",
        "result_key": "grid_kwh",
        "expected_initial": "526.315789473684210526315789473684210526315789473684210526315789",
        "expected_challenge": "555.555555555555555555555555555555555555555555555555555555555555",
    },
    {
        "id": "ride-through",
        "preset": "generator_failure",
        "field": "battery_initial_kwh",
        "initial": "100",
        "challenge": "50",
        "result_key": "battery_depleted",
        "expected_initial": "607.8",
        "expected_challenge": "453.9",
    },
    {
        "id": "generator-delay",
        "preset": "utility_loss",
        "field": "generator_start_delay_s",
        "initial": "30",
        "challenge": "60",
        "result_key": "generator_ready",
        "expected_initial": "330",
        "expected_challenge": "360",
    },
    {
        "id": "generator-failure",
        "preset": "generator_failure",
        "field": "generator_available",
        "initial": "0",
        "challenge": "1",
        "result_key": "unserved_duration_s",
        "expected_initial": "292.2",
        "expected_challenge": "0",
    },
    {
        "id": "n-plus-one",
        "preset": "path_maintenance",
        "field": "path_capacity",
        "initial": "700",
        "challenge": "1100",
        "result_key": "peak_unserved_kw",
        "expected_initial": "335",
        "expected_challenge": "0",
    },
    {
        "id": "shared-controls",
        "preset": "shared_domain",
        "field": "shared_controls",
        "initial": "1",
        "challenge": "0",
        "result_key": "peak_unserved_kw",
        "expected_initial": "1000",
        "expected_challenge": "335",
    },
    {
        "id": "single-point",
        "preset": "normal",
        "field": "main_bus_available",
        "initial": "0",
        "challenge": "1",
        "result_key": "unserved_it_kwh",
        "expected_initial": "166.666666666666666666666666666666666666666666666666666666666666",
        "expected_challenge": "0",
    },
    {
        "id": "precharge",
        "preset": "generator_failure",
        "field": "battery_charge_kw",
        "initial": "100",
        "challenge": "0",
        "result_key": "battery_depleted",
        "expected_initial": "478.2675",
        "expected_challenge": "453.9",
    },
    {
        "id": "ai-outage",
        "preset": "ai_cluster_generator_failure",
        "field": "battery_initial_kwh",
        "initial": "5000",
        "challenge": "2500",
        "result_key": "battery_depleted",
        "expected_initial": "607.8",
        "expected_challenge": "478.2675",
    },
    {
        "id": "recovery-deadline",
        "preset": "generator_failure",
        "field": "battery_initial_kwh",
        "initial": "57",
        "challenge": "58",
        "result_key": "unserved_duration_s",
        "expected_initial": "0.1865",
        "expected_challenge": "0",
    },
    {
        "id": "pue",
        "preset": "normal",
        "field": "pue",
        "initial": "1.25",
        "challenge": "1.15",
        "result_key": "facility_energy_kwh",
        "expected_initial": "547500000",
        "expected_challenge": "503700000",
    },
)


def _scenario_for_lesson(case: dict, value: str):
    """Apply lesson changes independently of the TypeScript transformation."""
    lesson_id = case["id"]
    scenario = demo_scenario(case["preset"])
    if lesson_id == "power-energy":
        return replace(scenario, it_demand_kw=value)
    if lesson_id == "distribution-loss":
        return replace(scenario, distribution_efficiency=value)
    if lesson_id == "ride-through":
        return replace(scenario, battery_initial_kwh=value, battery_charge_kw=0)
    if lesson_id == "generator-delay":
        return replace(scenario, generator_start_delay_s=int(value))
    if lesson_id == "generator-failure":
        if int(value) == 1:
            scenario = replace(
                scenario,
                events=tuple(event for event in scenario.events if event.target != "generator"),
            )
        return scenario
    if lesson_id == "n-plus-one":
        assets = tuple(
            replace(asset, capacity_kw=value)
            if asset.kind == "distribution"
            else asset
            for asset in scenario.assets
        )
        return replace(scenario, assets=assets)
    if lesson_id == "shared-controls":
        if int(value) == 0:
            assets = tuple(
                replace(
                    asset,
                    failure_domains=tuple(
                        domain
                        for domain in asset.failure_domains
                        if domain != "shared-controls"
                    ),
                )
                if asset.id == "path-b"
                else asset
                for asset in scenario.assets
            )
            scenario = replace(scenario, assets=assets)
        return scenario
    if lesson_id == "single-point":
        events = () if int(value) == 1 else (
            Event(300, "asset_down", "main-bus", None),
            Event(900, "asset_up", "main-bus", None),
        )
        return replace(scenario, events=events)
    if lesson_id == "precharge":
        return replace(scenario, battery_initial_kwh=50, battery_charge_kw=value)
    if lesson_id == "ai-outage":
        return replace(scenario, battery_initial_kwh=value)
    if lesson_id == "recovery-deadline":
        events = tuple(
            replace(event, at_s=500)
            if event.target == "utility" and event.action == "asset_up"
            else event
            for event in scenario.events
        )
        return replace(scenario, battery_initial_kwh=value, events=events)
    raise AssertionError(f"Unhandled lesson {lesson_id}")


def _planning_result(pue: str) -> dict:
    scenario = Scenario.from_dict(
        {
            "schema_version": 1,
            "id": "course-pue",
            "name": "50 MW annual energy planning",
            "currency": "USD",
            "it_capacity_kw": "50000",
            "tariff_per_kwh": None,
            "price_status": "unknown",
            "assumption_date": "2026-09-12",
            "source_ids": ["EDU-POWER-001"],
            "segments": [
                {
                    "label": "Assumed constant annual load",
                    "hours": "8760",
                    "it_load_kw": "50000",
                    "assumed_pue": pue,
                }
            ],
        }
    )
    return simulate(scenario)


class CourseLessonTests(unittest.TestCase):
    def assert_quantity_close(self, actual: str, expected: str) -> None:
        difference = abs(Fraction(actual) - Fraction(expected))
        # Export formatting keeps 100 decimal digits; the table records enough
        # digits to check the independent result without copying that formatter.
        self.assertLess(difference, Fraction(1, 10**50))

    def assert_lesson_result(self, case: dict, value: str, expected: str) -> None:
        if case["id"] == "pue":
            result = _planning_result(value)
            self.assert_quantity_close(result[case["result_key"]], expected)
            return
        result = simulate_continuity(_scenario_for_lesson(case, value)).to_dict()
        if case["result_key"] in ("battery_depleted", "generator_ready"):
            action = (
                "battery_depleted"
                if case["result_key"] == "battery_depleted"
                else "generator_start_requested"
            )
            event = next(item for item in result["events"] if item["action"] == action)
            actual = event["at_s"] if action == "battery_depleted" else event["ready_at_s"]
        else:
            actual = result["summary"][case["result_key"]]
        self.assert_quantity_close(actual, expected)

    def test_defaults_and_challenges_match_independent_native_expectations(self):
        for case in LESSON_CASES:
            with self.subTest(lesson=case["id"], value="initial"):
                self.assert_lesson_result(
                    case, case["initial"], case["expected_initial"]
                )
            with self.subTest(lesson=case["id"], value="challenge"):
                self.assert_lesson_result(
                    case, case["challenge"], case["expected_challenge"]
                )


if __name__ == "__main__":
    unittest.main()
