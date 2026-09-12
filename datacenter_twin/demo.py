"""Bundled synthetic scenario presets; no vendor or facility parameters inferred."""

from decimal import Decimal
from importlib.resources import files
import json

from .contracts import InputError
from .topology import SiteScenario

PRESETS = {
    "normal": "Normal supply",
    "utility_loss": "Utility loss / generator pickup",
    "generator_failure": "Generator failure / battery depletion",
    "path_maintenance": "A-path maintenance / surviving overload",
    "shared_domain": "Shared control-domain failure",
    "ai_cluster_utility_loss": "50 MW AI cluster / generator pickup",
    "ai_cluster_generator_failure": "50 MW AI cluster / generator failure",
}

_AI_CLUSTER_SOURCE_ID = "SYN-AI-50MW-001"
_AI_CLUSTER_SCALE = Decimal("50")
_AI_CLUSTER_EVENT_PRESETS = {
    "ai_cluster_utility_loss": "utility_loss",
    "ai_cluster_generator_failure": "generator_failure",
}


def _scenario_event(at_s: int, action: str, target: str) -> dict:
    """Create an availability event with the contract's explicit null value."""
    return {"at_s": at_s, "action": action, "target": target, "value_kw": None}


def _events_for_preset(preset: str) -> list[dict]:
    """Return the original outage sequence for a base or scaled preset."""
    event_preset = _AI_CLUSTER_EVENT_PRESETS.get(preset, preset)
    events = []
    if event_preset in ("utility_loss", "generator_failure"):
        events.append(_scenario_event(300, "asset_down", "utility"))
        if event_preset == "generator_failure":
            events.append(_scenario_event(300, "asset_down", "generator"))
        events.append(_scenario_event(900, "asset_up", "utility"))
        if event_preset == "generator_failure":
            events.append(_scenario_event(900, "asset_up", "generator"))
    elif event_preset == "path_maintenance":
        events.append(_scenario_event(300, "asset_down", "path-a"))
        events.append(_scenario_event(900, "asset_up", "path-a"))
    elif event_preset == "shared_domain":
        events.append(_scenario_event(300, "domain_down", "shared-controls"))
        events.append(_scenario_event(900, "domain_up", "shared-controls"))
    return events


def _scale_ai_cluster(data: dict) -> None:
    """Scale aggregate electrical quantities while retaining all timing inputs.

    The result is a 50 MW electrical teaching case.  It carries no GPU count,
    workload throughput, grid-adequacy, or facility-prediction claim.
    """
    for field in (
        "it_demand_kw",
        "it_capacity_kw",
        "battery_capacity_kwh",
        "battery_initial_kwh",
        "battery_charge_kw",
    ):
        data[field] = str(Decimal(data[field]) * _AI_CLUSTER_SCALE)
    for asset in data["assets"]:
        asset["capacity_kw"] = str(
            Decimal(asset["capacity_kw"]) * _AI_CLUSTER_SCALE
        )
    data["source_ids"] = [*data["source_ids"], _AI_CLUSTER_SOURCE_ID]


def demo_scenario(preset: str = "utility_loss") -> SiteScenario:
    if preset not in PRESETS:
        raise InputError("Unknown demo preset")
    resource = files("datacenter_twin").joinpath("resources/reference-site-v2.json")
    data = json.loads(resource.read_text(encoding="utf-8"))
    if preset in _AI_CLUSTER_EVENT_PRESETS:
        _scale_ai_cluster(data)
    data["events"] = _events_for_preset(preset)
    data.update(id=f"demo-{preset}", name=PRESETS[preset])
    return SiteScenario.from_dict(data)
