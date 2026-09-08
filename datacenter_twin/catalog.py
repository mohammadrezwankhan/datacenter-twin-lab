"""Source-backed options and explicit, illustrative billing normalization."""

from decimal import Decimal, localcontext
from importlib.resources import files
import json

from .contracts import InputError, _keys, _text, decimal_text, number
from .engine import ARITHMETIC
from .topology import bounded_integer


def load_catalog() -> dict:
    return json.loads(files("datacenter_twin").joinpath("resources/catalog.json").read_text(encoding="utf-8"))


def normalize_quote(data: dict) -> dict:
    """Hours are already billed node-hours per node, not an inferred invoice duration."""
    _keys(data, {"offer_id", "node_count", "billed_hours", "assumed_rate"}, "quote")
    offer_id = _text(data["offer_id"], "offer_id")
    offer = next((o for o in load_catalog()["cloud_offers"] if o["id"] == offer_id), None)
    if offer is None:
        raise InputError("offer_id: unknown catalogue offer")
    count = bounded_integer(data["node_count"], "node_count", 1, 100000)
    hours = number(data["billed_hours"], "billed_hours")
    rate = None if data["assumed_rate"] is None else number(data["assumed_rate"], "assumed_rate")
    with localcontext(ARITHMETIC):
        node_hours = count * hours
        units = node_hours * (offer["gpu_count"] if offer["billing_unit"] == "gpu_hour" else 1)
        total = None if rate is None else units * rate
        node_rate = None if rate is None else rate * (offer["gpu_count"] if offer["billing_unit"] == "gpu_hour" else 1)
        gpu_rate = None if node_rate is None else node_rate / offer["gpu_count"]
        return {"offer": offer, "inputs": {"offer_id": offer_id, "node_count": count,
                "billed_hours": decimal_text(hours), "assumed_rate": None if rate is None else decimal_text(rate)},
                "billing_unit": offer["billing_unit"], "billed_units": decimal_text(units),
                "billed_node_hours": decimal_text(node_hours),
                "normalized_node_hour_rate": None if node_rate is None else decimal_text(node_rate),
                "provisioned_gpu_hour_rate": None if gpu_rate is None else decimal_text(gpu_rate),
                "cost": None if total is None else format(total.quantize(Decimal("0.01")), "f"),
                "currency": offer["currency"], "price_status": "unknown" if rate is None else "user_assumption",
                "source_ids": offer["source_ids"], "calibrated": False,
                "limitations": ["User-entered rate is an assumption, not a fetched vendor quote.",
                    "Already-billed hours exclude invoice granularity, minimums, taxes and ancillary charges.",
                    "No workload throughput, utilization, region availability or performance equivalence is inferred."]}
