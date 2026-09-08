"""Deterministic max-flow dispatch and exact rational energy accounting."""

from collections import deque
from dataclasses import dataclass
from decimal import Decimal, localcontext
from fractions import Fraction as F
import hashlib
import json

from . import __version__
from .contracts import InputError, decimal_text
from .engine import ARITHMETIC
from .topology import SiteScenario, topological_order


def text(value: F) -> str:
    with localcontext(ARITHMETIC):
        return decimal_text(Decimal(value.numerator) / Decimal(value.denominator))


def money(value: F | None) -> str | None:
    if value is None:
        return None
    with localcontext(ARITHMETIC):
        return format((Decimal(value.numerator) / Decimal(value.denominator)).quantize(Decimal("0.01")), ".2f")


class FlowNetwork:
    def __init__(self):
        self.residual = {}
        self.capacity = {}

    def add(self, source, target, capacity):
        self.residual.setdefault(source, {})[target] = capacity
        self.residual.setdefault(target, {})[source] = F(0)
        self.capacity[(source, target)] = capacity

    def flow(self, source, target):
        return self.capacity[(source, target)] - self.residual[source][target]

    def augment(self):
        while True:
            parents = {"SOURCE": None}
            queue = deque(["SOURCE"])
            while queue and "SINK" not in parents:
                current = queue.popleft()
                for target in sorted(self.residual[current]):
                    if target not in parents and self.residual[current][target] > 0:
                        parents[target] = current
                        queue.append(target)
            if "SINK" not in parents:
                return
            current, amount = "SINK", None
            while parents[current] is not None:
                previous = parents[current]
                value = self.residual[previous][current]
                amount = value if amount is None else min(amount, value)
                current = previous
            current = "SINK"
            while parents[current] is not None:
                previous = parents[current]
                self.residual[previous][current] -= amount
                self.residual[current][previous] += amount
                current = previous


@dataclass(frozen=True)
class SimulationRun:
    run_id: str
    input_sha256: str
    scenario: SiteScenario
    intervals: tuple[dict, ...]
    events: tuple[dict, ...]
    summary: dict

    def to_dict(self):
        return {"schema_version": 2, "model": "single_load_electrical_continuity_v1",
                "engine_version": __version__, "run_id": self.run_id, "input_sha256": self.input_sha256,
                "mode": "SIMULATED", "quality": "synthetic_uncalibrated", "scenario": self.scenario.to_dict(),
                "intervals": list(self.intervals), "events": list(self.events), "summary": self.summary,
                "boundary": "Electrical supply, stored battery energy, conversion losses and served IT; cooling excluded",
                "limitations": ["No switching transient, protection study, cooling, workload queue or certification model.",
                                "Generator starts on utility-asset unavailability only; downstream path faults do not request a start.",
                                "Generator fuel is assumed sufficient for this horizon; its unit energy cost may be unknown.",
                                "Initial stored battery energy is an opening balance; prior charging cost is excluded.",
                                "Prices are illustrative inputs; costs exclude CAPEX and non-energy charges."]}


def simulate_continuity(scenario: SiteScenario) -> SimulationRun:
    if not isinstance(scenario, SiteScenario):
        raise InputError("Expected a validated SiteScenario")
    canonical = json.dumps(scenario.to_dict(), sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    run_id = hashlib.sha256(f"continuity-v1:{__version__}:{digest}".encode()).hexdigest()[:20]
    assets = {asset.id: asset for asset in scenario.assets}
    kinds = {kind: next(a.id for a in scenario.assets if a.kind == kind) for kind in ("utility", "generator", "battery", "load")}
    utility, generator, battery, load = (kinds[kind] for kind in ("utility", "generator", "battery", "load"))
    requires_order = topological_order(scenario.assets, scenario.dependencies, "requires")
    incoming_requires = {asset_id: [edge.source for edge in scenario.dependencies if edge.target == asset_id and edge.relation == "requires"] for asset_id in assets}
    schedule = sorted(enumerate(scenario.events), key=lambda pair: (pair[1].at_s, pair[0]))
    direct_down, domains_down = set(), set()
    index = 0
    now, demand = F(0), F(scenario.it_demand_kw)
    energy = F(scenario.battery_initial_kwh)
    capacity = F(scenario.battery_capacity_kwh)
    eta, charge_eta, discharge_eta = map(F, (scenario.distribution_efficiency, scenario.battery_charge_efficiency, scenario.battery_discharge_efficiency))
    ready_at = None
    rows, log = [], []
    totals = {key: F(0) for key in ("requested_it_kwh", "served_it_kwh", "unserved_it_kwh", "grid_kwh", "generator_kwh",
                                    "distribution_loss_kwh", "battery_charge_loss_kwh", "battery_discharge_loss_kwh",
                                    "battery_stored_change_kwh", "unserved_duration_s")}
    peak_unserved = F(0)
    while now < scenario.duration_s:
        if len(rows) > 5000:
            raise InputError("Simulation exceeded its interval budget")
        while index < len(schedule) and schedule[index][1].at_s == now:
            order, event = schedule[index]
            if event.action == "asset_down": direct_down.add(event.target)
            elif event.action == "asset_up": direct_down.discard(event.target)
            elif event.action == "domain_down": domains_down.add(event.target)
            elif event.action == "domain_up": domains_down.discard(event.target)
            else: demand = F(event.value_kw)
            log.append({**event.to_dict(), "at_s": text(F(event.at_s)), "sequence": order, "origin": "scenario_event"})
            index += 1
        available = {}
        for asset_id in requires_order:
            asset = assets[asset_id]
            available[asset_id] = (asset_id not in direct_down and not domains_down.intersection(asset.failure_domains)
                                   and all(available[source] for source in incoming_requires[asset_id]))
        if available[utility] or not available[generator]:
            ready_at = None
        elif ready_at is None:
            ready_at = now + scenario.generator_start_delay_s
            log.append({"at_s": text(now), "action": "generator_start_requested", "target": generator,
                        "ready_at_s": text(ready_at), "origin": "simulation"})
        running = ready_at is not None and now >= ready_at and available[generator]
        boundary = min(now + scenario.step_s, F(scenario.duration_s))
        if index < len(schedule): boundary = min(boundary, F(schedule[index][1].at_s))
        if ready_at is not None and ready_at > now: boundary = min(boundary, ready_at)

        network = FlowNetwork()
        infinity = sum((F(asset.capacity_kw) for asset in scenario.assets), F(0))
        for asset_id in sorted(assets):
            network.add(f"in:{asset_id}", f"out:{asset_id}", F(assets[asset_id].capacity_kw) if available[asset_id] else F(0))
        for edge in sorted(scenario.dependencies, key=lambda e: (e.source, e.target, e.relation)):
            if edge.relation == "feeds":
                network.add(f"out:{edge.source}", f"in:{edge.target}", infinity)
        network.add(f"out:{load}", "SINK", demand / eta)
        # Incremental max-flow preserves dispatch priority while allowing residual rerouting.
        for source, enabled in ((utility, available[utility]), (generator, running), (battery, energy > 0 and available[battery])):
            network.add("SOURCE", f"in:{source}", F(assets[source].capacity_kw) if enabled else F(0))
            network.augment()
        gross_load = network.flow(f"out:{load}", "SINK")
        battery_kw = network.flow("SOURCE", f"in:{battery}")
        generator_kw = network.flow("SOURCE", f"in:{generator}")
        charging_kw = F(0)
        if battery_kw == 0 and generator_kw == 0 and available[utility] and available[battery] and energy < capacity:
            # Charge only from spare utility capacity, never by circulating battery energy.
            for source in (generator, battery):
                network.residual["SOURCE"][f"in:{source}"] = F(0)
                network.capacity[("SOURCE", f"in:{source}")] = F(0)
            charging_edge = next(edge for edge in scenario.dependencies if edge.relation == "charges")
            network.add(f"out:{charging_edge.source}", "CHARGER", F(scenario.battery_charge_kw))
            network.add("CHARGER", "SINK", F(scenario.battery_charge_kw))
            network.augment()
            charging_kw = network.flow("CHARGER", "SINK")
        grid_kw = network.flow("SOURCE", f"in:{utility}")
        if battery_kw:
            boundary = min(boundary, now + energy * discharge_eta / battery_kw * 3600)
        if charging_kw:
            boundary = min(boundary, now + (capacity - energy) / (charging_kw * charge_eta) * 3600)
        seconds, hours = boundary - now, (boundary - now) / 3600
        if seconds <= 0:
            raise RuntimeError("Non-progressing simulation boundary")
        previous_energy = energy
        battery_out = battery_kw * hours / discharge_eta
        battery_in = charging_kw * hours * charge_eta
        energy = energy - battery_out + battery_in
        served = gross_load * eta
        unserved = demand - served
        values = {"requested_it_kwh": demand * hours, "served_it_kwh": served * hours,
                  "unserved_it_kwh": unserved * hours, "grid_kwh": grid_kw * hours,
                  "generator_kwh": generator_kw * hours, "distribution_loss_kwh": (gross_load - served) * hours,
                  "battery_charge_loss_kwh": charging_kw * hours - battery_in,
                  "battery_discharge_loss_kwh": battery_out - battery_kw * hours,
                  "battery_stored_change_kwh": energy - previous_energy,
                  "unserved_duration_s": seconds if unserved > 0 else F(0)}
        residual = values["grid_kwh"] + values["generator_kwh"] - values["battery_stored_change_kwh"] - values["served_it_kwh"] - values["distribution_loss_kwh"] - values["battery_charge_loss_kwh"] - values["battery_discharge_loss_kwh"]
        if residual or not 0 <= energy <= capacity or unserved < 0:
            raise RuntimeError("Electrical energy invariant violated")
        for key, value in values.items(): totals[key] += value
        peak_unserved = max(peak_unserved, unserved)
        warnings = []
        if unserved > 0: warnings.append("UNSERVED_IT_LOAD")
        if demand > F(scenario.it_capacity_kw): warnings.append("IT_ENVELOPE_EXCEEDED")
        if not available[utility]: warnings.append("UTILITY_UNAVAILABLE")
        if energy == 0: warnings.append("BATTERY_EMPTY")
        if domains_down: warnings.append("SHARED_DOMAIN_OUTAGE")
        asset_states = {asset_id: "available" if available[asset_id] else "unavailable" for asset_id in assets}
        if available[generator]: asset_states[generator] = "running" if running else "starting" if ready_at is not None else "standby"
        if available[battery]: asset_states[battery] = "discharging" if battery_kw else "charging" if charging_kw else "empty" if energy == 0 else "ready"
        if available[load]: asset_states[load] = "unserved" if served == 0 and demand > 0 else "degraded" if unserved else "served"
        rows.append({"start_s": text(now), "end_s": text(boundary), "duration_s": text(seconds),
                     "requested_it_kw": text(demand), "served_it_kw": text(served), "unserved_it_kw": text(unserved),
                     "electrical_source_kw": text(grid_kw + generator_kw + battery_kw),
                     "grid_kw": text(grid_kw), "generator_kw": text(generator_kw), "battery_discharge_kw": text(battery_kw),
                     "battery_charge_kw": text(charging_kw), "battery_start_kwh": text(previous_energy), "battery_end_kwh": text(energy),
                     "it_capacity_margin_kw": text(F(scenario.it_capacity_kw) - demand),
                     "grid_energy_charge_to_date": money(None if scenario.tariff_per_kwh is None else totals["grid_kwh"] * F(scenario.tariff_per_kwh)),
                     "energy": {key: text(value) for key, value in values.items()}, "energy_balance_residual_kwh": "0",
                     "asset_states": asset_states, "warnings": warnings,
                     "feed_flows_kw": [{"source": edge.source, "target": edge.target,
                                        "kw": text(network.flow(f"out:{edge.source}", f"in:{edge.target}"))}
                                       for edge in scenario.dependencies if edge.relation == "feeds"]})
        if energy == 0 and previous_energy > 0:
            log.append({"at_s": text(boundary), "action": "battery_depleted", "target": battery, "origin": "simulation"})
        now = boundary
    grid_cost = None if scenario.tariff_per_kwh is None else totals["grid_kwh"] * F(scenario.tariff_per_kwh)
    generator_cost = (F(0) if totals["generator_kwh"] == 0 else None if scenario.generator_cost_per_kwh is None
                      else totals["generator_kwh"] * F(scenario.generator_cost_per_kwh))
    summary = {**{key: text(value) for key, value in totals.items()}, "battery_final_kwh": text(energy),
               "peak_unserved_kw": text(peak_unserved), "energy_balance_residual_kwh": "0",
               "grid_energy_charge": money(grid_cost), "generator_energy_charge": money(generator_cost),
               "total_incremental_energy_charge": money(None if grid_cost is None or generator_cost is None else grid_cost + generator_cost),
               "cost_status": "unknown_component" if grid_cost is None or generator_cost is None else "illustrative",
               "service_status": "unserved_load" if totals["unserved_it_kwh"] else "served_throughout",
               "interval_count": len(rows)}
    return SimulationRun(run_id, digest, scenario, tuple(rows), tuple(log), summary)
