"""Bounded numerical studies adapted from the supplied Python equivalents.

The import archive was supplied as ``python_equivalent.zip`` (SHA-256
``c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab``).
Its README maps the equations to MATLAB files, but those MATLAB files and the
GPU measurement trace were not included. These studies therefore reproduce
the supplied Python equations; they do not claim MATLAB or measurement
validation.
"""

from __future__ import annotations

from copy import deepcopy
from decimal import Decimal
from math import isfinite
from numbers import Real
from typing import Any

from .sdcib import run_sdcib_study
from .model_comparison import run_model_comparison
from .grid_network import run_grid_network


STUDY_DEFAULTS: dict[str, dict[str, float]] = {
    "load-step": {
        "load_initial_pu": 0.5,
        "load_final_pu": 0.6,
        "vsi_bandwidth_hz": 80.0,
        "grid_reactance_pu": 0.19,
        "dc_capacitance_pu": 2.0,
    },
    "modal": {
        "load_pu": 0.5,
        "vsi_bandwidth_hz": 80.0,
        "grid_reactance_pu": 0.19,
        "dc_capacitance_pu": 2.0,
    },
    "forced-response": {
        "load_pu": 0.5,
        "vsi_bandwidth_hz": 80.0,
        "grid_reactance_pu": 0.19,
        "dc_capacitance_pu": 2.0,
        "forcing_frequency_hz": 5.0,
        "forcing_amplitude_pu": 0.03,
    },
    "model-comparison": {"load_final_pu": 0.6},
    "grid-network": {"load_scale": 0.5},
}

STUDY_LIMITS: dict[str, dict[str, tuple[float, float]]] = {
    "load-step": {
        "load_initial_pu": (0.3, 0.7),
        "load_final_pu": (0.4, 0.8),
        "vsi_bandwidth_hz": (60.0, 100.0),
        "grid_reactance_pu": (0.1, 0.3),
        "dc_capacitance_pu": (1.0, 3.0),
    },
    "modal": {
        "load_pu": (0.3, 0.7),
        "vsi_bandwidth_hz": (60.0, 100.0),
        "grid_reactance_pu": (0.1, 0.3),
        "dc_capacitance_pu": (1.0, 3.0),
    },
    "forced-response": {
        "load_pu": (0.3, 0.7),
        "vsi_bandwidth_hz": (60.0, 100.0),
        "grid_reactance_pu": (0.1, 0.3),
        "dc_capacitance_pu": (1.0, 3.0),
        "forcing_frequency_hz": (0.5, 30.0),
        "forcing_amplitude_pu": (0.01, 0.05),
    },
    "model-comparison": {"load_final_pu": (0.5, 0.6)},
    "grid-network": {"load_scale": (0.4, 0.6)},
}


def _normalize_config(study_id: str, config: dict[str, Any]) -> dict[str, float]:
    if study_id not in STUDY_DEFAULTS:
        supported = ", ".join(STUDY_DEFAULTS)
        raise ValueError(f"Unknown study_id {study_id!r}; choose one of: {supported}.")
    if not isinstance(config, dict):
        raise ValueError("config must be a JSON object.")
    defaults = STUDY_DEFAULTS[study_id]
    unknown = set(config) - set(defaults)
    if unknown:
        raise ValueError(
            f"Unsupported {study_id} configuration field(s): {', '.join(sorted(map(str, unknown)))}."
        )
    normalized: dict[str, float] = {}
    for field, (low, high) in STUDY_LIMITS[study_id].items():
        value = config.get(field, defaults[field])
        if isinstance(value, bool) or not isinstance(value, (Real, Decimal)):
            # JSON decoders may supply Decimal, which is numeric but does not
            # register as Real on all Python versions.
            raise ValueError(f"{field} must be a finite number from {low:g} to {high:g}.")
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"{field} must be a finite number from {low:g} to {high:g}.") from exc
        if not isfinite(number) or number < low or number > high:
            raise ValueError(f"{field} must be from {low:g} to {high:g}.")
        normalized[field] = number
    if study_id == "load-step" and normalized["load_final_pu"] <= normalized["load_initial_pu"]:
        raise ValueError("load_final_pu must exceed load_initial_pu for this load-step study.")
    return normalized


def _validate_result(
    result: dict[str, Any], study_id: str, config: dict[str, float]
) -> dict[str, Any]:
    result.setdefault("study_id", study_id)
    result.setdefault("config", deepcopy(config))
    result.setdefault("solver", {})
    result.setdefault("assumptions", [])
    result.setdefault("metrics", [])
    result.setdefault("charts", [])
    result.setdefault("diagnostics", {})
    if result["study_id"] != study_id or not isinstance(result["model"], str):
        raise ValueError("Study implementation returned an invalid result identity.")
    if not isinstance(result["charts"], list) or not isinstance(result["metrics"], list):
        raise ValueError("Study implementation returned invalid chart or metric data.")

    def visit(value: Any) -> None:
        if isinstance(value, float) and not isfinite(value):
            raise ValueError("Study did not converge to finite results; no result was returned.")
        if isinstance(value, dict):
            for child in value.values():
                visit(child)
        elif isinstance(value, (list, tuple)):
            for child in value:
                visit(child)

    visit(result)
    return result


def run_study(study_id: str, config: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run one bounded imported study and return finite JSON-compatible data."""
    config = {} if config is None else config
    normalized = _normalize_config(study_id, config)
    if study_id in {"load-step", "modal", "forced-response"}:
        result = run_sdcib_study(study_id, normalized)
    elif study_id == "model-comparison":
        result = run_model_comparison(normalized)
    else:
        result = run_grid_network(normalized)
    return _validate_result(result, study_id, normalized)


__all__ = ["STUDY_DEFAULTS", "STUDY_LIMITS", "run_study"]
