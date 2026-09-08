"""Small arithmetic primitives for future domain modules; no vendor prices."""

from decimal import Decimal, localcontext

from .contracts import InputError, number
from .engine import ARITHMETIC


def node_charge(billed_node_hours, node_hour_price, gpus_per_node: int) -> dict:
    hours = number(billed_node_hours, "billed_node_hours")
    if type(gpus_per_node) is not int or gpus_per_node <= 0:
        raise InputError("gpus_per_node: expected a positive integer")
    rate = None if node_hour_price is None else number(node_hour_price, "node_hour_price")
    with localcontext(ARITHMETIC):
        return {"cost": None if rate is None else hours * rate,
                "provisioned_gpu_hour_rate": None if rate is None else rate / gpus_per_node,
                "billing_unit": "node_hour"}


def token_charge(input_tokens, output_tokens, input_price_per_million, output_price_per_million):
    inputs, outputs = number(input_tokens, "input_tokens"), number(output_tokens, "output_tokens")
    for value in (inputs, outputs):
        if value != value.to_integral_value():
            raise InputError("Token counts must be whole numbers")
    rates = [None if value is None else number(value, label) for value, label in
             ((input_price_per_million, "input_price_per_million"),
              (output_price_per_million, "output_price_per_million"))]
    if None in rates:
        return None
    with localcontext(ARITHMETIC):
        return (inputs * rates[0] + outputs * rates[1]) / Decimal(1000000)


def battery_runtime_hours(deliverable_energy_kwh, load_kw):
    """Energy is already deliverable at the load boundary; no efficiency inferred."""
    energy, load = number(deliverable_energy_kwh, "deliverable_energy_kwh"), number(load_kw, "load_kw")
    with localcontext(ARITHMETIC):
        return None if load == 0 else energy / load


def steady_heat_kw(mass_flow_kg_s, specific_heat_kj_kg_k, delta_temperature_k):
    flow = number(mass_flow_kg_s, "mass_flow_kg_s")
    heat = number(specific_heat_kj_kg_k, "specific_heat_kj_kg_k", positive=True)
    delta = number(delta_temperature_k, "delta_temperature_k")
    with localcontext(ARITHMETIC):
        return flow * heat * delta
