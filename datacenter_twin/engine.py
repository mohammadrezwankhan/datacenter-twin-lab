"""Coarse assumed-PUE energy demand, with a reproducible accounting boundary."""

from decimal import Context, Decimal, ROUND_HALF_EVEN, localcontext
import hashlib
import json

from . import __version__
from .contracts import InputError, Scenario, decimal_text

# Four bounded input factors (<= 1e12, <= 9 places) and 10,000 intervals
# require at most 89 significant digits before final monetary rounding.
ARITHMETIC = Context(prec=100, rounding=ROUND_HALF_EVEN)


def simulate(scenario: Scenario) -> dict:
    if not isinstance(scenario, Scenario):
        raise InputError(
            "Expected a validated Scenario; use Scenario.from_dict for JSON objects"
        )
    canonical = json.dumps(scenario.to_dict(), sort_keys=True, separators=(",", ":"))
    input_hash = hashlib.sha256(canonical.encode()).hexdigest()
    run_id = hashlib.sha256(f"{__version__}:{input_hash}".encode()).hexdigest()[:20]
    with localcontext(ARITHMETIC):
        total_hours = it_energy = facility_energy = Decimal(0)
        peak_it = Decimal(0)
        intervals = []
        for segment in scenario.segments:
            it_kwh = segment.it_load_kw * segment.hours
            facility_kw = segment.it_load_kw * segment.assumed_pue
            facility_kwh = facility_kw * segment.hours
            intervals.append(
                {
                    **segment.to_dict(),
                    "facility_demand_kw": decimal_text(facility_kw),
                    "it_energy_kwh": decimal_text(it_kwh),
                    "facility_energy_kwh": decimal_text(facility_kwh),
                    "exceeds_it_capacity": segment.it_load_kw > scenario.it_capacity_kw,
                }
            )
            total_hours += segment.hours
            it_energy += it_kwh
            facility_energy += facility_kwh
            peak_it = max(peak_it, segment.it_load_kw)
        cost = (
            None
            if scenario.tariff_per_kwh is None
            else format(
                (facility_energy * scenario.tariff_per_kwh).quantize(Decimal("0.01")),
                ".2f",
            )
        )
        return {
            "schema_version": 1,
            "engine_version": __version__,
            "run_id": run_id,
            "input_sha256": input_hash,
            "scenario_id": scenario.id,
            "scenario_name": scenario.name,
            "mode": "SYNTHETIC_PLANNING",
            "fidelity": "coarse_assumed_pue",
            "evidence_level": "arithmetic_verified_only",
            "source_ids": list(scenario.source_ids),
            "assumptions": scenario.to_dict(),
            "currency": scenario.currency,
            "boundary": (
                "IT demand plus aggregate non-IT overhead; all facility energy assumed grid-imported"
            ),
            "duration_hours": decimal_text(total_hours),
            "it_energy_kwh": decimal_text(it_energy),
            "facility_energy_kwh": decimal_text(facility_energy),
            "non_it_energy_kwh": decimal_text(facility_energy - it_energy),
            "period_pue": None
            if it_energy == 0
            else decimal_text(facility_energy / it_energy),
            "pue_undefined_reason": "No IT energy in this period" if it_energy == 0 else None,
            "peak_it_demand_kw": decimal_text(peak_it),
            "it_capacity_margin_kw": decimal_text(scenario.it_capacity_kw - peak_it),
            "capacity_screen": (
                "exceeds_envelope"
                if peak_it > scenario.it_capacity_kw
                else "within_envelope"
            ),
            "energy_only_cost": cost,
            "cost_unknown_reason": "Tariff is unknown" if cost is None else None,
            "intervals": intervals,
            "limitations": [
                "Demand estimate; supply continuity and delivered service are not simulated.",
                "PUE is an input assumption; cooling and losses must not be added again.",
                "Energy-only cost excludes demand charges, CAPEX, taxes and all other charges.",
                "Capacity screen does not establish electrical feasibility, resilience or certification.",
            ],
        }


def compare(baseline: Scenario, alternative: Scenario) -> dict:
    with localcontext(ARITHMETIC):
        if baseline.currency != alternative.currency:
            raise InputError(
                "Comparison requires the same currency; no FX conversion is implemented"
            )
        left, right = simulate(baseline), simulate(alternative)
        # Comparisons preserve workload and time so lower demand is not sold as an efficiency saving.
        left_work = [(s.hours, s.it_load_kw) for s in baseline.segments]
        right_work = [(s.hours, s.it_load_kw) for s in alternative.segments]
        if left_work != right_work:
            raise InputError("Comparison requires identical interval durations and IT loads")
        savings = (
            None
            if left["energy_only_cost"] is None
            or right["energy_only_cost"] is None
            else format(
                Decimal(left["energy_only_cost"])
                - Decimal(right["energy_only_cost"]),
                ".2f",
            )
        )
        return {
            "baseline": left,
            "alternative": right,
            "currency": baseline.currency,
            "facility_energy_saving_kwh": decimal_text(
                Decimal(left["facility_energy_kwh"])
                - Decimal(right["facility_energy_kwh"])
            ),
            "energy_only_cost_saving": savings,
            "comparison_boundary": (
                "Identical IT load intervals; baseline minus alternative. No investment ranking."
            ),
        }
