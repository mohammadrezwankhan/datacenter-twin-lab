"""Small arithmetic primitives for future domain modules; no vendor prices."""

from decimal import Decimal, localcontext
from typing import Literal, TypedDict

from .contracts import InputError, number
from .engine import ARITHMETIC


class NodeCharge(TypedDict):
    cost: Decimal | None
    provisioned_gpu_hour_rate: Decimal | None
    billing_unit: Literal["node_hour"]


def node_charge(
    billed_node_hours: object, node_hour_price: object, gpus_per_node: int
) -> NodeCharge:
    hours = number(billed_node_hours, "billed_node_hours")
    if type(gpus_per_node) is not int or gpus_per_node <= 0:
        raise InputError("gpus_per_node: expected a positive integer")
    rate = None if node_hour_price is None else number(node_hour_price, "node_hour_price")
    with localcontext(ARITHMETIC):
        return {
            "cost": None if rate is None else hours * rate,
            "provisioned_gpu_hour_rate": None if rate is None else rate / gpus_per_node,
            "billing_unit": "node_hour",
        }


def token_charge(
    input_tokens: object,
    output_tokens: object,
    input_price_per_million: object,
    output_price_per_million: object,
) -> Decimal | None:
    inputs, outputs = number(input_tokens, "input_tokens"), number(output_tokens, "output_tokens")
    for value in (inputs, outputs):
        if value != value.to_integral_value():
            raise InputError("Token counts must be whole numbers")
    rates = [
        None if value is None else number(value, label)
        for value, label in (
            (input_price_per_million, "input_price_per_million"),
            (output_price_per_million, "output_price_per_million"),
        )
    ]
    input_rate, output_rate = rates
    if input_rate is None or output_rate is None:
        return None
    with localcontext(ARITHMETIC):
        return (inputs * input_rate + outputs * output_rate) / Decimal(1000000)


def battery_runtime_hours(deliverable_energy_kwh: object, load_kw: object) -> Decimal | None:
    """Energy is already deliverable at the load boundary; no efficiency inferred."""
    energy, load = (
        number(deliverable_energy_kwh, "deliverable_energy_kwh"),
        number(load_kw, "load_kw"),
    )
    with localcontext(ARITHMETIC):
        return None if load == 0 else energy / load


def steady_heat_kw(
    mass_flow_kg_s: object, specific_heat_kj_kg_k: object, delta_temperature_k: object
) -> Decimal:
    flow = number(mass_flow_kg_s, "mass_flow_kg_s")
    heat = number(specific_heat_kj_kg_k, "specific_heat_kj_kg_k", positive=True)
    delta = number(delta_temperature_k, "delta_temperature_k")
    with localcontext(ARITHMETIC):
        return flow * heat * delta
