"""Deterministic one-parameter sensitivity sweeps for schema-v2 continuity."""

from dataclasses import replace
from decimal import Decimal
import hashlib
import json
from typing import Any

from . import __version__
from .continuity import SimulationRun, simulate_continuity
from .contracts import InputError, decimal_text, number
from .topology import SiteScenario


SWEEP_PARAMETERS = {
    "battery_initial_kwh": "kWh",
    "it_demand_kw": "kW",
    "generator_start_delay_s": "s",
    "distribution_efficiency": "ratio",
}
_MAX_VALUES = 20
_MAX_FULL_RESULT_BYTES = 16 * 1024 * 1024


def _value(value: Any, parameter: str, index: int) -> tuple[Decimal, str]:
    """Parse one public sweep value without accepting ambiguous booleans."""

    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise InputError(f"values[{index}]: expected a finite decimal value")
    parsed = number(value, f"values[{index}]")
    if parameter == "generator_start_delay_s":
        if parsed != parsed.to_integral_value():
            raise InputError(
                f"values[{index}]: generator_start_delay_s must be an integer number of seconds"
            )
        parsed = parsed.to_integral_value()
    return parsed, decimal_text(parsed)


def _summary(run: SimulationRun) -> dict[str, Any]:
    """Expose the exact ledger plus report-friendly aliases and unknown costs."""

    summary = dict(run.summary)
    warning_counts: dict[str, int] = {}
    for interval in run.intervals:
        for warning in interval.get("warnings", []):
            warning_counts[warning] = warning_counts.get(warning, 0) + 1
    unknowns = [key for key in ("generator_energy_charge", "total_incremental_energy_charge")
                if summary.get(key) is None]
    summary.update({
        "requested_kwh": summary["requested_it_kwh"],
        "served_kwh": summary["served_it_kwh"],
        "unserved_kwh": summary["unserved_it_kwh"],
        "unserved_seconds": summary["unserved_duration_s"],
        "first_battery_depletion_s": next(
            (event["at_s"] for event in run.events if event["action"] == "battery_depleted"),
            None,
        ),
        "cost_unknowns": unknowns,
        "warning_counts": warning_counts,
    })
    return summary


def _canonical_digest(scenario: SiteScenario) -> str:
    canonical = json.dumps(scenario.to_dict(), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def sweep_continuity(scenario: SiteScenario, parameter: str, values: list[str | int]) -> dict:
    """Run independent simulations while varying one validated scenario field.

    Values are normalised to the scenario's decimal representation, retained in
    caller order, and applied to a fresh immutable scenario for every run.
    """

    if not isinstance(scenario, SiteScenario):
        raise InputError("Expected a validated SiteScenario")
    if not isinstance(parameter, str) or parameter not in SWEEP_PARAMETERS:
        supported = ", ".join(sorted(SWEEP_PARAMETERS))
        raise InputError(f"parameter: expected one of {supported}")
    if not isinstance(values, list) or not values:
        raise InputError("values: expected a nonempty list")
    if len(values) > _MAX_VALUES:
        raise InputError(f"values: at most {_MAX_VALUES} values are supported")

    parsed_values: list[tuple[Decimal, str]] = []
    labels: set[str] = set()
    for index, raw in enumerate(values):
        parsed, label = _value(raw, parameter, index)
        if label in labels:
            raise InputError(f"values: duplicate value {label}")
        labels.add(label)
        parsed_values.append((parsed, label))

    base_run = simulate_continuity(scenario)
    runs: list[dict[str, Any]] = []
    full_results: list[dict] = []
    full_size = 0
    include_full = True
    for parsed, label in parsed_values:
        candidate_value = (
            int(parsed) if parameter == "generator_start_delay_s" else parsed
        )
        candidate = replace(scenario, **{parameter: candidate_value})
        run = simulate_continuity(candidate)
        run_result = run.to_dict()
        if include_full:
            full_size += len(json.dumps(run_result, sort_keys=True, separators=(",", ":"), ensure_ascii=True))
            if full_size <= _MAX_FULL_RESULT_BYTES:
                full_results.append(run_result)
            else:
                # Release retained details as soon as the bounded export limit
                # is crossed; summaries continue to be collected below.
                include_full = False
                full_results.clear()
        runs.append({
            "value": label,
            "value_label": f"{label} {SWEEP_PARAMETERS[parameter]}",
            "value_unit": SWEEP_PARAMETERS[parameter],
            "run_id": run.run_id,
            "input_sha256": run.input_sha256,
            "summary": _summary(run),
        })

    if include_full:
        for entry, run_result in zip(runs, full_results):
            entry["result"] = run_result

    return {
        "schema_version": 2,
        "model": "single_load_electrical_continuity_sensitivity_v1",
        "engine_version": __version__,
        "base_run_id": base_run.run_id,
        "base_input_sha256": _canonical_digest(scenario),
        "base_scenario": scenario.to_dict(),
        "parameter": parameter,
        "parameter_unit": SWEEP_PARAMETERS[parameter],
        "values": [label for _, label in parsed_values],
        "runs": runs,
        "full_results_included": include_full,
        "full_results_limit_bytes": _MAX_FULL_RESULT_BYTES,
        "assumptions": [
            "Each value is evaluated from the same starting schema-v2 scenario.",
            "Values change one scenario field; battery capacity and all other topology inputs remain fixed.",
            "Energy accounting is exact within the synthetic single-IT-load continuity model.",
        ],
        "limitations": [
            "This is a deterministic sensitivity sweep, not calibration or a forecast.",
            (
                "Cooling, workload queues, switching transients, protection studies "
                "and physical controls are outside the model."
            ),
            (
                "Costs remain illustrative or unknown according to the scenario tariff "
                "and generator cost inputs."
            ),
        ],
    }
