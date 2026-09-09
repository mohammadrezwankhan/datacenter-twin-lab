"""JSON-only adapter for the original engine running inside a browser worker.

No networking, filesystem writes, dynamic Python execution, or shared service.
"""

import json
from urllib.parse import parse_qs, urlsplit

from .catalog import load_catalog, normalize_quote
from .contracts import InputError, MAX_SCENARIO_BYTES, parse_json_document
from .continuity import simulate_continuity
from .demo import PRESETS, demo_scenario
from .topology import SiteScenario
from .reporting import render_html, render_markdown
from .sensitivity import sweep_continuity


def scenario_report(payload: dict) -> dict:
    if not isinstance(payload, dict) or set(payload) != {"scenario", "format"}:
        raise InputError("Report requires scenario and format")
    if payload["format"] not in ("markdown", "html"):
        raise InputError("Report format must be markdown or html")
    run = simulate_continuity(SiteScenario.from_dict(payload["scenario"])).to_dict()
    renderer = render_html if payload["format"] == "html" else render_markdown
    return {"format": payload["format"], "text": renderer(run), "run_id": run["run_id"]}


def scenario_sweep(payload: dict) -> dict:
    if not isinstance(payload, dict) or set(payload) != {"scenario", "parameter", "values"}:
        raise InputError("Sweep requires scenario, parameter, and values")
    return sweep_continuity(SiteScenario.from_dict(payload["scenario"]),
                            payload["parameter"], payload["values"])


def dispatch_json(path: str, body: str = "null") -> str:
    """Dispatch a fixed set of operations; user input is JSON, never Python code."""
    if len(body.encode("utf-8")) > MAX_SCENARIO_BYTES:
        raise InputError("Request exceeds the 4 MiB input limit")
    route = urlsplit(path)
    if route.path == "presets":
        result = [{"id": key, "name": name} for key, name in PRESETS.items()]
    elif route.path == "demo":
        preset = parse_qs(route.query).get("preset", ["utility_loss"])[0]
        result = demo_scenario(preset).to_dict()
    elif route.path == "catalog":
        result = load_catalog()
    elif route.path in ("simulations", "quotes/normalize", "reports", "sweeps"):
        payload = parse_json_document(body.encode("utf-8"))
        if route.path == "simulations":
            result = simulate_continuity(SiteScenario.from_dict(payload)).to_dict()
        elif route.path == "quotes/normalize":
            result = normalize_quote(payload)
        elif route.path == "reports":
            result = scenario_report(payload)
        else:
            result = scenario_sweep(payload)
    else:
        raise InputError("Unsupported browser operation")
    return json.dumps(result, ensure_ascii=True, allow_nan=False, separators=(",", ":"))
