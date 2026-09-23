"""Bundled synthetic presets; no vendor or facility parameters inferred."""

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

# These are illustrative scaling anchors for teaching cases, not measured
# facility designs. Power is an aggregate IT load in MW; stored energy is
# scaled at 100 kWh per MW (0.1 h gross initial reserve).
FACILITY_PROFILES = {
    "ai_cluster_50mw": {
        "name": "AI cluster",
        "load_mw": 50,
        "scale": Decimal("50"),
        "source_id": _AI_CLUSTER_SOURCE_ID,
    },
    "hyperscale_200mw": {
        "name": "Hyperscale",
        "load_mw": 200,
        "scale": Decimal("200"),
        "source_id": "SYN-FACILITY-HYPERSCALE-200MW-001",
    },
    "crypto_30mw": {
        "name": "Crypto mining",
        "load_mw": 30,
        "scale": Decimal("30"),
        "source_id": "SYN-FACILITY-CRYPTO-30MW-001",
    },
    "traditional_5mw": {
        "name": "Traditional",
        "load_mw": 5,
        "scale": Decimal("5"),
        "source_id": "SYN-FACILITY-TRADITIONAL-5MW-001",
    },
}

FACILITY_PRESETS = {
    "ai_cluster_50mw": {
        "outage": "ai_cluster_generator_failure",
        "ramp": "ai_cluster_50mw_ramp",
        "reserve": "ai_cluster_50mw_reserve",
    },
    "hyperscale_200mw": {
        "outage": "hyperscale_200mw_outage",
        "ramp": "hyperscale_200mw_ramp",
        "reserve": "hyperscale_200mw_reserve",
    },
    "crypto_30mw": {
        "outage": "crypto_30mw_outage",
        "ramp": "crypto_30mw_ramp",
        "reserve": "crypto_30mw_reserve",
    },
    "traditional_5mw": {
        "outage": "traditional_5mw_outage",
        "ramp": "traditional_5mw_ramp",
        "reserve": "traditional_5mw_reserve",
    },
}

_FACILITY_PRESET_LOOKUP = {
    preset: (profile_id, mode)
    for profile_id, modes in FACILITY_PRESETS.items()
    for mode, preset in modes.items()
}

for _profile_id, _modes in FACILITY_PRESETS.items():
    if _profile_id == "ai_cluster_50mw":
        # Preserve the existing 50 MW generator-failure preset and its output.
        _modes_to_add = {key: value for key, value in _modes.items() if key != "outage"}
    else:
        _modes_to_add = _modes
    _load_mw = FACILITY_PROFILES[_profile_id]["load_mw"]
    for _mode, _preset in _modes_to_add.items():
        _description = {
            "outage": "grid + generator outage",
            "ramp": "aggregate IT load steps",
            "reserve": "3 h grid + generator outage",
        }[_mode]
        PRESETS[_preset] = f"{FACILITY_PROFILES[_profile_id]['name']} / {_load_mw} MW / {_description}"


def _scenario_event(at_s: int, action: str, target: str) -> dict:
    """Create an availability event with the contract's explicit null value."""
    return {"at_s": at_s, "action": action, "target": target, "value_kw": None}


def _demand_event(at_s: int, demand_kw: Decimal) -> dict:
    """Create an aggregate IT load step; this does not model a transient."""
    return {
        "at_s": at_s,
        "action": "set_demand",
        "target": "it-load",
        "value_kw": format(demand_kw.normalize(), "f"),
    }


def _events_for_preset(preset: str) -> list[dict]:
    """Return deterministic outage or aggregate-load event inputs."""
    facility_case = _FACILITY_PRESET_LOOKUP.get(preset)
    if facility_case is not None:
        profile_id, mode = facility_case
        load_kw = Decimal(FACILITY_PROFILES[profile_id]["load_mw"]) * Decimal("1000")
        if mode == "ramp":
            # 300 s at nominal, 300 s at 80%, 300 s at 110%, then nominal.
            return [
                _demand_event(300, load_kw * Decimal("0.8")),
                _demand_event(600, load_kw * Decimal("1.1")),
                _demand_event(900, load_kw),
            ]
        recovery_s = 900 if mode == "outage" else 11_100
        events = [
            _scenario_event(300, "asset_down", "utility"),
            _scenario_event(300, "asset_down", "generator"),
            _scenario_event(recovery_s, "asset_up", "utility"),
            _scenario_event(recovery_s, "asset_up", "generator"),
        ]
        return events

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


def _scale_facility(data: dict, profile_id: str) -> None:
    """Scale the reference topology linearly for an aggregate IT load profile."""
    profile = FACILITY_PROFILES[profile_id]
    scale = profile["scale"]
    for field in (
        "it_demand_kw",
        "it_capacity_kw",
        "battery_capacity_kwh",
        "battery_initial_kwh",
        "battery_charge_kw",
    ):
        data[field] = str(Decimal(data[field]) * scale)
    for asset in data["assets"]:
        asset["capacity_kw"] = str(Decimal(asset["capacity_kw"]) * scale)
    data["source_ids"] = [*data["source_ids"], profile["source_id"]]


def demo_scenario(preset: str = "utility_loss") -> SiteScenario:
    if preset not in PRESETS:
        raise InputError("Unknown demo preset")
    resource = files("datacenter_twin").joinpath("resources/reference-site-v2.json")
    data = json.loads(resource.read_text(encoding="utf-8"))
    facility_case = _FACILITY_PRESET_LOOKUP.get(preset)
    if facility_case is not None:
        profile_id, mode = facility_case
        _scale_facility(data, profile_id)
        if preset not in _AI_CLUSTER_EVENT_PRESETS:
            # Trace the added event schedules and reserve sizing separately
            # while preserving the original seven scenarios byte-for-byte.
            data["source_ids"].append("SYN-ENERGY-WORKSPACE-001")
        if mode == "ramp":
            # The 110% input step is inside this declared IT envelope.
            data["it_capacity_kw"] = str(
                Decimal(data["it_demand_kw"]) * Decimal("1.1")
            )
        if mode == "reserve":
            # Four-hour gross stored reserve; finite 4 h run and a 3 h outage.
            reserve_kwh = Decimal(data["it_demand_kw"]) * Decimal("4")
            data["battery_capacity_kwh"] = str(reserve_kwh)
            data["battery_initial_kwh"] = str(reserve_kwh)
            # Isolate the opening-reserve question from a later charging phase.
            data["battery_charge_kw"] = "0"
            # The outage runs from 300 s to 11,100 s: exactly three hours.
            data["duration_s"] = 14_400
            data["step_s"] = 60
    elif preset in _AI_CLUSTER_EVENT_PRESETS:
        _scale_ai_cluster(data)
    data["events"] = _events_for_preset(preset)
    data.update(id=f"demo-{preset}", name=PRESETS[preset])
    return SiteScenario.from_dict(data)
