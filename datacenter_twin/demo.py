"""Bundled synthetic scenario presets; no vendor or facility parameters inferred."""

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
}


def demo_scenario(preset: str = "utility_loss") -> SiteScenario:
    if preset not in PRESETS:
        raise InputError("Unknown demo preset")
    data = json.loads(files("datacenter_twin").joinpath("resources/reference-site-v2.json").read_text(encoding="utf-8"))
    events = []

    def event(at, action, target):
        events.append({"at_s": at, "action": action, "target": target, "value_kw": None})

    if preset in ("utility_loss", "generator_failure"):
        event(300, "asset_down", "utility")
        if preset == "generator_failure": event(300, "asset_down", "generator")
        event(900, "asset_up", "utility")
        if preset == "generator_failure": event(900, "asset_up", "generator")
    if preset == "path_maintenance":
        event(300, "asset_down", "path-a")
        event(900, "asset_up", "path-a")
    if preset == "shared_domain":
        event(300, "domain_down", "shared-controls")
        event(900, "domain_up", "shared-controls")
    data.update(id=f"demo-{preset}", name=PRESETS[preset], events=events)
    return SiteScenario.from_dict(data)
