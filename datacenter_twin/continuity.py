"""Deterministic max-flow dispatch and exact rational energy accounting.

The simulator keeps the electrical model deliberately small: one IT load,
explicit source paths, a finite battery, and a delayed generator.  The helper
phases below make the event, dispatch, boundary, and accounting decisions
visible without changing the model's deterministic ordering.
"""

from collections import deque
from dataclasses import dataclass
from decimal import Decimal, localcontext
from fractions import Fraction
import hashlib
import json

from . import __version__
from .contracts import InputError, decimal_text
from .engine import ARITHMETIC
from .topology import SiteScenario, topological_order


def format_quantity(value: Fraction) -> str:
    """Format an exact rational quantity with the shared decimal context."""
    with localcontext(ARITHMETIC):
        return decimal_text(Decimal(value.numerator) / Decimal(value.denominator))


def format_currency(value: Fraction | None) -> str | None:
    """Format an optional exact currency amount to two decimal places."""
    if value is None:
        return None
    with localcontext(ARITHMETIC):
        decimal_value = Decimal(value.numerator) / Decimal(value.denominator)
        return format(decimal_value.quantize(Decimal("0.01")), ".2f")


def text(value: Fraction) -> str:
    """Preserve the historical quantity-formatting import for callers."""
    return format_quantity(value)


def money(value: Fraction | None) -> str | None:
    """Preserve the historical currency-formatting import for callers."""
    return format_currency(value)


class FlowNetwork:
    """Small deterministic residual network used for source dispatch."""

    def __init__(self):
        self.residual = {}
        self.capacity = {}

    def add(self, source, target, capacity):
        self.residual.setdefault(source, {})[target] = capacity
        self.residual.setdefault(target, {})[source] = Fraction(0)
        self.capacity[(source, target)] = capacity

    def flow(self, source, target):
        return self.capacity[(source, target)] - self.residual[source][target]

    def augment(self):
        """Apply sorted breadth-first augmentations until no path remains."""
        while True:
            parents = self._find_augmenting_path()
            if parents is None:
                return
            amount = self._capacity_from_parents(parents)
            self._apply_augmentation(parents, amount)

    def _find_augmenting_path(self):
        parents = {"SOURCE": None}
        queue = deque(["SOURCE"])
        while queue and "SINK" not in parents:
            current = queue.popleft()
            for target in sorted(self.residual[current]):
                if target not in parents and self.residual[current][target] > 0:
                    parents[target] = current
                    queue.append(target)
        return parents if "SINK" in parents else None

    def _capacity_from_parents(self, parents):
        current = "SINK"
        amount = None
        while parents[current] is not None:
            previous = parents[current]
            edge_capacity = self.residual[previous][current]
            amount = edge_capacity if amount is None else min(amount, edge_capacity)
            current = previous
        return amount

    def _apply_augmentation(self, parents, amount):
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
        return {
            "schema_version": 2,
            "model": "single_load_electrical_continuity_v1",
            "engine_version": __version__,
            "run_id": self.run_id,
            "input_sha256": self.input_sha256,
            "mode": "SIMULATED",
            "quality": "synthetic_uncalibrated",
            "scenario": self.scenario.to_dict(),
            "intervals": list(self.intervals),
            "events": list(self.events),
            "summary": self.summary,
            "boundary": (
                "Electrical supply, stored battery energy, conversion losses and served IT; "
                "cooling excluded"
            ),
            "limitations": [
                "No switching transient, protection study, cooling, workload queue or certification model.",
                "Generator starts on utility-asset unavailability only; downstream path faults "
                "do not request a start.",
                "Generator fuel is assumed sufficient for this horizon; its unit energy cost may be unknown.",
                "Initial stored battery energy is an opening balance; prior charging cost is excluded.",
                "Prices are illustrative inputs; costs exclude CAPEX and non-energy charges.",
            ],
        }


@dataclass(frozen=True)
class _SimulationSetup:
    assets: dict
    utility_id: str
    generator_id: str
    battery_id: str
    load_id: str
    requires_order: list[str]
    incoming_requires: dict[str, list[str]]
    schedule: list[tuple[int, object]]


@dataclass
class _SimulationState:
    now: Fraction
    demand_kw: Fraction
    stored_energy_kwh: Fraction
    event_index: int
    direct_down: set[str]
    domains_down: set[str]
    generator_ready_at: Fraction | None
    rows: list[dict]
    event_log: list[dict]
    totals: dict[str, Fraction]
    peak_unserved_kw: Fraction


@dataclass(frozen=True)
class _DispatchResult:
    network: FlowNetwork
    gross_load_kw: Fraction
    grid_kw: Fraction
    generator_kw: Fraction
    battery_kw: Fraction
    charging_kw: Fraction


@dataclass(frozen=True)
class _IntervalAccounting:
    boundary: Fraction
    seconds: Fraction
    hours: Fraction
    stored_energy_kwh: Fraction
    served_kw: Fraction
    unserved_kw: Fraction
    values: dict[str, Fraction]


def _prepare_simulation(scenario: SiteScenario):
    canonical = json.dumps(scenario.to_dict(), sort_keys=True, separators=(",", ":"))
    input_sha256 = hashlib.sha256(canonical.encode()).hexdigest()
    run_id = hashlib.sha256(
        f"continuity-v1:{__version__}:{input_sha256}".encode()
    ).hexdigest()[:20]

    assets = {asset.id: asset for asset in scenario.assets}
    asset_by_kind = {
        kind: next(asset.id for asset in scenario.assets if asset.kind == kind)
        for kind in ("utility", "generator", "battery", "load")
    }
    requires_order = topological_order(scenario.assets, scenario.dependencies, "requires")
    incoming_requires = {
        asset_id: [
            edge.source
            for edge in scenario.dependencies
            if edge.target == asset_id and edge.relation == "requires"
        ]
        for asset_id in assets
    }
    schedule = sorted(
        enumerate(scenario.events), key=lambda pair: (pair[1].at_s, pair[0])
    )
    setup = _SimulationSetup(
        assets=assets,
        utility_id=asset_by_kind["utility"],
        generator_id=asset_by_kind["generator"],
        battery_id=asset_by_kind["battery"],
        load_id=asset_by_kind["load"],
        requires_order=requires_order,
        incoming_requires=incoming_requires,
        schedule=schedule,
    )
    return setup, input_sha256, run_id


def _new_simulation_state(scenario: SiteScenario) -> _SimulationState:
    total_keys = (
        "requested_it_kwh",
        "served_it_kwh",
        "unserved_it_kwh",
        "grid_kwh",
        "generator_kwh",
        "distribution_loss_kwh",
        "battery_charge_loss_kwh",
        "battery_discharge_loss_kwh",
        "battery_stored_change_kwh",
        "unserved_duration_s",
    )
    return _SimulationState(
        now=Fraction(0),
        demand_kw=Fraction(scenario.it_demand_kw),
        stored_energy_kwh=Fraction(scenario.battery_initial_kwh),
        event_index=0,
        direct_down=set(),
        domains_down=set(),
        generator_ready_at=None,
        rows=[],
        event_log=[],
        totals={key: Fraction(0) for key in total_keys},
        peak_unserved_kw=Fraction(0),
    )


def _apply_events_at_current_time(
    state: _SimulationState,
    setup: _SimulationSetup,
) -> None:
    """Apply same-time events by original sequence, retaining deterministic order."""
    while (
        state.event_index < len(setup.schedule)
        and setup.schedule[state.event_index][1].at_s == state.now
    ):
        sequence, event = setup.schedule[state.event_index]
        if event.action == "asset_down":
            state.direct_down.add(event.target)
        elif event.action == "asset_up":
            state.direct_down.discard(event.target)
        elif event.action == "domain_down":
            state.domains_down.add(event.target)
        elif event.action == "domain_up":
            state.domains_down.discard(event.target)
        else:
            state.demand_kw = Fraction(event.value_kw)
        state.event_log.append(
            {
                **event.to_dict(),
                "at_s": format_quantity(Fraction(event.at_s)),
                "sequence": sequence,
                "origin": "scenario_event",
            }
        )
        state.event_index += 1


def _calculate_availability(
    state: _SimulationState,
    setup: _SimulationSetup,
) -> dict[str, bool]:
    """Propagate direct and failure-domain outages through requires edges."""
    available = {}
    for asset_id in setup.requires_order:
        asset = setup.assets[asset_id]
        direct_failure = asset_id in state.direct_down
        domain_failure = bool(state.domains_down.intersection(asset.failure_domains))
        dependencies_available = all(
            available[source] for source in setup.incoming_requires[asset_id]
        )
        available[asset_id] = not direct_failure and not domain_failure and dependencies_available
    return available


def _update_generator_readiness(
    state: _SimulationState,
    scenario: SiteScenario,
    setup: _SimulationSetup,
    available: dict[str, bool],
) -> bool:
    """Request a start only for utility loss and expose the current running state."""
    utility_available = available[setup.utility_id]
    generator_available = available[setup.generator_id]
    if utility_available or not generator_available:
        state.generator_ready_at = None
    elif state.generator_ready_at is None:
        state.generator_ready_at = state.now + scenario.generator_start_delay_s
        state.event_log.append(
            {
                "at_s": format_quantity(state.now),
                "action": "generator_start_requested",
                "target": setup.generator_id,
                "ready_at_s": format_quantity(state.generator_ready_at),
                "origin": "simulation",
            }
        )
    return (
        state.generator_ready_at is not None
        and state.now >= state.generator_ready_at
        and generator_available
    )


def _build_dispatch_network(
    scenario: SiteScenario,
    setup: _SimulationSetup,
    available: dict[str, bool],
    demand_kw: Fraction,
    distribution_efficiency: Fraction,
) -> FlowNetwork:
    network = FlowNetwork()
    total_capacity_kw = sum(
        (Fraction(asset.capacity_kw) for asset in setup.assets.values()), Fraction(0)
    )
    for asset_id in sorted(setup.assets):
        capacity_kw = (
            Fraction(setup.assets[asset_id].capacity_kw) if available[asset_id] else Fraction(0)
        )
        network.add(f"in:{asset_id}", f"out:{asset_id}", capacity_kw)
    for edge in sorted(
        scenario.dependencies,
        key=lambda dependency: (
            dependency.source,
            dependency.target,
            dependency.relation,
        ),
    ):
        if edge.relation == "feeds":
            network.add(
                f"out:{edge.source}", f"in:{edge.target}", total_capacity_kw
            )
    network.add(
        f"out:{setup.load_id}", "SINK", demand_kw / distribution_efficiency
    )
    return network


def _dispatch_sources(
    network: FlowNetwork,
    setup: _SimulationSetup,
    available: dict[str, bool],
    generator_running: bool,
    stored_energy_kwh: Fraction,
) -> None:
    """Add and augment sources in utility, generator, battery priority order."""
    sources = (
        (setup.utility_id, available[setup.utility_id]),
        (setup.generator_id, generator_running),
        (setup.battery_id, stored_energy_kwh > 0 and available[setup.battery_id]),
    )
    for source_id, enabled in sources:
        source_capacity_kw = (
            Fraction(setup.assets[source_id].capacity_kw) if enabled else Fraction(0)
        )
        network.add("SOURCE", f"in:{source_id}", source_capacity_kw)
        # Incremental augmentation preserves source priority while allowing
        # residual rerouting around a saturated path.
        network.augment()


def _dispatch_charging(
    network: FlowNetwork,
    scenario: SiteScenario,
    setup: _SimulationSetup,
    available: dict[str, bool],
    generator_kw: Fraction,
    battery_kw: Fraction,
    stored_energy_kwh: Fraction,
    capacity_kwh: Fraction,
) -> Fraction:
    """Use only spare utility capacity for charging, never circulating battery flow."""
    can_charge = (
        battery_kw == 0
        and generator_kw == 0
        and available[setup.utility_id]
        and available[setup.battery_id]
        and stored_energy_kwh < capacity_kwh
    )
    if not can_charge:
        return Fraction(0)

    for source_id in (setup.generator_id, setup.battery_id):
        network.residual["SOURCE"][f"in:{source_id}"] = Fraction(0)
        network.capacity[("SOURCE", f"in:{source_id}")] = Fraction(0)
    charging_edge = next(
        edge for edge in scenario.dependencies if edge.relation == "charges"
    )
    network.add(
        f"out:{charging_edge.source}",
        "CHARGER",
        Fraction(scenario.battery_charge_kw),
    )
    network.add("CHARGER", "SINK", Fraction(scenario.battery_charge_kw))
    network.augment()
    return network.flow("CHARGER", "SINK")


def _dispatch_interval(
    scenario: SiteScenario,
    setup: _SimulationSetup,
    available: dict[str, bool],
    generator_running: bool,
    demand_kw: Fraction,
    stored_energy_kwh: Fraction,
    capacity_kwh: Fraction,
    distribution_efficiency: Fraction,
) -> _DispatchResult:
    network = _build_dispatch_network(
        scenario, setup, available, demand_kw, distribution_efficiency
    )
    _dispatch_sources(
        network,
        setup,
        available,
        generator_running,
        stored_energy_kwh,
    )
    gross_load_kw = network.flow(f"out:{setup.load_id}", "SINK")
    battery_kw = network.flow("SOURCE", f"in:{setup.battery_id}")
    generator_kw = network.flow("SOURCE", f"in:{setup.generator_id}")
    charging_kw = _dispatch_charging(
        network,
        scenario,
        setup,
        available,
        generator_kw,
        battery_kw,
        stored_energy_kwh,
        capacity_kwh,
    )
    # Charging augmentation may consume spare utility flow, so read grid
    # dispatch after that phase has finished.
    grid_kw = network.flow("SOURCE", f"in:{setup.utility_id}")
    return _DispatchResult(
        network=network,
        gross_load_kw=gross_load_kw,
        grid_kw=grid_kw,
        generator_kw=generator_kw,
        battery_kw=battery_kw,
        charging_kw=charging_kw,
    )


def _next_interval_boundary(
    state: _SimulationState,
    scenario: SiteScenario,
    setup: _SimulationSetup,
    battery_kw: Fraction,
    charging_kw: Fraction,
    charge_efficiency: Fraction,
    discharge_efficiency: Fraction,
    capacity_kwh: Fraction,
) -> Fraction:
    """Choose the earliest regular, event, generator, full, or empty boundary."""
    boundary = min(
        state.now + scenario.step_s,
        Fraction(scenario.duration_s),
    )
    if state.event_index < len(setup.schedule):
        next_event_at = Fraction(setup.schedule[state.event_index][1].at_s)
        boundary = min(boundary, next_event_at)
    if state.generator_ready_at is not None and state.generator_ready_at > state.now:
        boundary = min(boundary, state.generator_ready_at)
    if battery_kw:
        battery_empty_at = (
            state.now + state.stored_energy_kwh * discharge_efficiency / battery_kw * 3600
        )
        boundary = min(boundary, battery_empty_at)
    if charging_kw:
        battery_full_at = (
            state.now
            + (capacity_kwh - state.stored_energy_kwh)
            / (charging_kw * charge_efficiency)
            * 3600
        )
        boundary = min(boundary, battery_full_at)
    return boundary


def _calculate_interval_accounting(
    state: _SimulationState,
    dispatch: _DispatchResult,
    boundary: Fraction,
    distribution_efficiency: Fraction,
    charge_efficiency: Fraction,
    discharge_efficiency: Fraction,
    capacity_kwh: Fraction,
) -> _IntervalAccounting:
    seconds = boundary - state.now
    if seconds <= 0:
        raise RuntimeError("Non-progressing simulation boundary")
    hours = seconds / 3600
    previous_energy_kwh = state.stored_energy_kwh
    battery_out_kwh = dispatch.battery_kw * hours / discharge_efficiency
    battery_in_kwh = dispatch.charging_kw * hours * charge_efficiency
    stored_energy_kwh = previous_energy_kwh - battery_out_kwh + battery_in_kwh
    served_kw = dispatch.gross_load_kw * distribution_efficiency
    unserved_kw = state.demand_kw - served_kw
    values = {
        "requested_it_kwh": state.demand_kw * hours,
        "served_it_kwh": served_kw * hours,
        "unserved_it_kwh": unserved_kw * hours,
        "grid_kwh": dispatch.grid_kw * hours,
        "generator_kwh": dispatch.generator_kw * hours,
        "distribution_loss_kwh": (dispatch.gross_load_kw - served_kw) * hours,
        "battery_charge_loss_kwh": dispatch.charging_kw * hours - battery_in_kwh,
        "battery_discharge_loss_kwh": battery_out_kwh - dispatch.battery_kw * hours,
        "battery_stored_change_kwh": stored_energy_kwh - previous_energy_kwh,
        "unserved_duration_s": seconds if unserved_kw > 0 else Fraction(0),
    }
    # The residual checks source energy against served IT, conversion losses,
    # and the battery balance before any values are formatted for export.
    residual = (
        values["grid_kwh"]
        + values["generator_kwh"]
        - values["battery_stored_change_kwh"]
        - values["served_it_kwh"]
        - values["distribution_loss_kwh"]
        - values["battery_charge_loss_kwh"]
        - values["battery_discharge_loss_kwh"]
    )
    if residual or not 0 <= stored_energy_kwh <= capacity_kwh or unserved_kw < 0:
        raise RuntimeError("Electrical energy invariant violated")
    return _IntervalAccounting(
        boundary=boundary,
        seconds=seconds,
        hours=hours,
        stored_energy_kwh=stored_energy_kwh,
        served_kw=served_kw,
        unserved_kw=unserved_kw,
        values=values,
    )


def _accumulate_accounting(
    state: _SimulationState,
    accounting: _IntervalAccounting,
) -> None:
    for key, value in accounting.values.items():
        state.totals[key] += value
    state.peak_unserved_kw = max(state.peak_unserved_kw, accounting.unserved_kw)


def _interval_warnings(
    state: _SimulationState,
    scenario: SiteScenario,
    setup: _SimulationSetup,
    available: dict[str, bool],
    accounting: _IntervalAccounting,
) -> list[str]:
    warnings = []
    if accounting.unserved_kw > 0:
        warnings.append("UNSERVED_IT_LOAD")
    if state.demand_kw > Fraction(scenario.it_capacity_kw):
        warnings.append("IT_ENVELOPE_EXCEEDED")
    if not available[setup.utility_id]:
        warnings.append("UTILITY_UNAVAILABLE")
    if accounting.stored_energy_kwh == 0:
        warnings.append("BATTERY_EMPTY")
    if state.domains_down:
        warnings.append("SHARED_DOMAIN_OUTAGE")
    return warnings


def _asset_states(
    state: _SimulationState,
    setup: _SimulationSetup,
    available: dict[str, bool],
    generator_running: bool,
    dispatch: _DispatchResult,
    accounting: _IntervalAccounting,
) -> dict[str, str]:
    asset_states = {
        asset_id: "available" if available[asset_id] else "unavailable"
        for asset_id in setup.assets
    }
    if available[setup.generator_id]:
        asset_states[setup.generator_id] = (
            "running"
            if generator_running
            else "starting"
            if state.generator_ready_at is not None
            else "standby"
        )
    if available[setup.battery_id]:
        asset_states[setup.battery_id] = (
            "discharging"
            if dispatch.battery_kw
            else "charging"
            if dispatch.charging_kw
            else "empty"
            if accounting.stored_energy_kwh == 0
            else "ready"
        )
    if available[setup.load_id]:
        asset_states[setup.load_id] = (
            "unserved"
            if accounting.served_kw == 0 and state.demand_kw > 0
            else "degraded"
            if accounting.unserved_kw
            else "served"
        )
    return asset_states


def _build_interval_row(
    state: _SimulationState,
    scenario: SiteScenario,
    setup: _SimulationSetup,
    available: dict[str, bool],
    dispatch: _DispatchResult,
    accounting: _IntervalAccounting,
    generator_running: bool,
) -> dict:
    _accumulate_accounting(state, accounting)
    asset_states = _asset_states(
        state, setup, available, generator_running, dispatch, accounting
    )
    warnings = _interval_warnings(state, scenario, setup, available, accounting)
    values = accounting.values
    previous_energy_kwh = state.stored_energy_kwh
    feed_flows = [
        {
            "source": edge.source,
            "target": edge.target,
            "kw": format_quantity(
                dispatch.network.flow(f"out:{edge.source}", f"in:{edge.target}")
            ),
        }
        for edge in scenario.dependencies
        if edge.relation == "feeds"
    ]
    return {
        "start_s": format_quantity(state.now),
        "end_s": format_quantity(accounting.boundary),
        "duration_s": format_quantity(accounting.seconds),
        "requested_it_kw": format_quantity(state.demand_kw),
        "served_it_kw": format_quantity(accounting.served_kw),
        "unserved_it_kw": format_quantity(accounting.unserved_kw),
        "electrical_source_kw": format_quantity(
            dispatch.grid_kw + dispatch.generator_kw + dispatch.battery_kw
        ),
        "grid_kw": format_quantity(dispatch.grid_kw),
        "generator_kw": format_quantity(dispatch.generator_kw),
        "battery_discharge_kw": format_quantity(dispatch.battery_kw),
        "battery_charge_kw": format_quantity(dispatch.charging_kw),
        "battery_start_kwh": format_quantity(previous_energy_kwh),
        "battery_end_kwh": format_quantity(accounting.stored_energy_kwh),
        "it_capacity_margin_kw": format_quantity(
            Fraction(scenario.it_capacity_kw) - state.demand_kw
        ),
        "grid_energy_charge_to_date": format_currency(
            None
            if scenario.tariff_per_kwh is None
            else state.totals["grid_kwh"] * Fraction(scenario.tariff_per_kwh)
        ),
        "energy": {key: format_quantity(value) for key, value in values.items()},
        "energy_balance_residual_kwh": "0",
        "asset_states": asset_states,
        "warnings": warnings,
        "feed_flows_kw": feed_flows,
    }


def _build_summary(
    scenario: SiteScenario,
    state: _SimulationState,
) -> dict:
    grid_cost = (
        None
        if scenario.tariff_per_kwh is None
        else state.totals["grid_kwh"] * Fraction(scenario.tariff_per_kwh)
    )
    if state.totals["generator_kwh"] == 0:
        generator_cost = Fraction(0)
    elif scenario.generator_cost_per_kwh is None:
        generator_cost = None
    else:
        generator_cost = state.totals["generator_kwh"] * Fraction(
            scenario.generator_cost_per_kwh
        )
    return {
        **{key: format_quantity(value) for key, value in state.totals.items()},
        "battery_final_kwh": format_quantity(state.stored_energy_kwh),
        "peak_unserved_kw": format_quantity(state.peak_unserved_kw),
        "energy_balance_residual_kwh": "0",
        "grid_energy_charge": format_currency(grid_cost),
        "generator_energy_charge": format_currency(generator_cost),
        "total_incremental_energy_charge": format_currency(
            None
            if grid_cost is None or generator_cost is None
            else grid_cost + generator_cost
        ),
        "cost_status": (
            "unknown_component"
            if grid_cost is None or generator_cost is None
            else "illustrative"
        ),
        "service_status": (
            "unserved_load"
            if state.totals["unserved_it_kwh"]
            else "served_throughout"
        ),
        "interval_count": len(state.rows),
    }


def simulate_continuity(scenario: SiteScenario) -> SimulationRun:
    """Simulate a validated single-load electrical continuity scenario."""
    if not isinstance(scenario, SiteScenario):
        raise InputError("Expected a validated SiteScenario")
    setup, input_sha256, run_id = _prepare_simulation(scenario)
    state = _new_simulation_state(scenario)
    distribution_efficiency = Fraction(scenario.distribution_efficiency)
    charge_efficiency = Fraction(scenario.battery_charge_efficiency)
    discharge_efficiency = Fraction(scenario.battery_discharge_efficiency)
    capacity_kwh = Fraction(scenario.battery_capacity_kwh)

    while state.now < scenario.duration_s:
        if len(state.rows) > 5000:
            raise InputError("Simulation exceeded its interval budget")
        _apply_events_at_current_time(state, setup)
        available = _calculate_availability(state, setup)
        generator_running = _update_generator_readiness(
            state, scenario, setup, available
        )
        dispatch = _dispatch_interval(
            scenario,
            setup,
            available,
            generator_running,
            state.demand_kw,
            state.stored_energy_kwh,
            capacity_kwh,
            distribution_efficiency,
        )
        boundary = _next_interval_boundary(
            state,
            scenario,
            setup,
            dispatch.battery_kw,
            dispatch.charging_kw,
            charge_efficiency,
            discharge_efficiency,
            capacity_kwh,
        )
        accounting = _calculate_interval_accounting(
            state,
            dispatch,
            boundary,
            distribution_efficiency,
            charge_efficiency,
            discharge_efficiency,
            capacity_kwh,
        )
        state.rows.append(
            _build_interval_row(
                state,
                scenario,
                setup,
                available,
                dispatch,
                accounting,
                generator_running,
            )
        )
        if accounting.stored_energy_kwh == 0 and state.stored_energy_kwh > 0:
            state.event_log.append(
                {
                    "at_s": format_quantity(accounting.boundary),
                    "action": "battery_depleted",
                    "target": setup.battery_id,
                    "origin": "simulation",
                }
            )
        state.stored_energy_kwh = accounting.stored_energy_kwh
        state.now = accounting.boundary

    return SimulationRun(
        run_id,
        input_sha256,
        scenario,
        tuple(state.rows),
        tuple(state.event_log),
        _build_summary(scenario, state),
    )
