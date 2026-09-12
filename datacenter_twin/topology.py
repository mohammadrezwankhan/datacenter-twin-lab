"""Version 2 contracts for a bounded, single-load electrical continuity model."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from .contracts import InputError, _keys, _text, decimal_text, number


def fraction_value(value: Any, name: str) -> Decimal:
    result = number(value, name, positive=True)
    if result > 1:
        raise InputError(f"{name}: expected an efficiency in (0, 1]")
    return result


def bounded_integer(value: Any, name: str, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise InputError(f"{name}: expected an integer from {low} to {high}")
    return value


def string_list(value: Any, name: str, *, nonempty: bool = True) -> tuple[str, ...]:
    if not isinstance(value, (list, tuple)) or len(value) > 100 or (nonempty and not value):
        raise InputError(f"{name}: expected {'1' if nonempty else '0'} to 100 identifiers")
    result = tuple(_text(item, name) for item in value)
    if len(set(result)) != len(result):
        raise InputError(f"{name}: duplicate identifiers")
    return result


@dataclass(frozen=True)
class Asset:
    id: str
    name: str
    kind: str
    capacity_kw: Decimal
    failure_domains: tuple[str, ...]
    source_ids: tuple[str, ...]

    def __post_init__(self):
        _text(self.id, "asset.id")
        _text(self.name, "asset.name")
        if self.kind not in ("utility", "generator", "battery", "bus", "distribution", "load"):
            raise InputError("asset.kind: unsupported asset type")
        object.__setattr__(self, "capacity_kw", number(self.capacity_kw, "capacity_kw", positive=True))
        object.__setattr__(self, "failure_domains", string_list(self.failure_domains, "failure_domains"))
        object.__setattr__(self, "source_ids", string_list(self.source_ids, "source_ids"))

    @classmethod
    def from_dict(cls, data):
        _keys(data, {"id", "name", "kind", "capacity_kw", "failure_domains", "source_ids"}, "asset")
        return cls(**data)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "kind": self.kind,
                "capacity_kw": decimal_text(self.capacity_kw),
                "failure_domains": list(self.failure_domains), "source_ids": list(self.source_ids)}


@dataclass(frozen=True)
class Dependency:
    source: str
    target: str
    relation: str

    def __post_init__(self):
        _text(self.source, "dependency.source")
        _text(self.target, "dependency.target")
        if self.source == self.target or self.relation not in ("feeds", "requires", "charges"):
            raise InputError("dependency: distinct endpoints and feeds/requires/charges relation required")

    @classmethod
    def from_dict(cls, data):
        _keys(data, {"source", "target", "relation"}, "dependency")
        return cls(**data)

    def to_dict(self):
        return {"source": self.source, "target": self.target, "relation": self.relation}


@dataclass(frozen=True)
class Event:
    at_s: int
    action: str
    target: str
    value_kw: Decimal | None

    def __post_init__(self):
        bounded_integer(self.at_s, "event.at_s", 0, 86400)
        _text(self.target, "event.target")
        if self.action not in ("asset_down", "asset_up", "domain_down", "domain_up", "set_demand"):
            raise InputError("event.action: unsupported simulated event")
        if self.action == "set_demand":
            object.__setattr__(self, "value_kw", number(self.value_kw, "event.value_kw"))
        elif self.value_kw is not None:
            raise InputError("event.value_kw: must be null for availability events")

    @classmethod
    def from_dict(cls, data):
        _keys(data, {"at_s", "action", "target", "value_kw"}, "event")
        return cls(**data)

    def to_dict(self):
        return {"at_s": self.at_s, "action": self.action, "target": self.target,
                "value_kw": None if self.value_kw is None else decimal_text(self.value_kw)}


def topological_order(
    assets: tuple[Asset, ...],
    dependencies: tuple[Dependency, ...],
    relation: str,
) -> list[str]:
    ids = {asset.id for asset in assets}
    incoming = {asset_id: 0 for asset_id in ids}
    outgoing = {asset_id: [] for asset_id in ids}
    for edge in dependencies:
        if edge.relation == relation:
            incoming[edge.target] += 1
            outgoing[edge.source].append(edge.target)
    queue = sorted(asset_id for asset_id in ids if incoming[asset_id] == 0)
    result = []
    while queue:
        current = queue.pop(0)
        result.append(current)
        for target in sorted(outgoing[current]):
            incoming[target] -= 1
            if incoming[target] == 0:
                queue.append(target)
                queue.sort()
    if len(result) != len(ids):
        raise InputError(f"Topology contains a {relation} cycle")
    return result


@dataclass(frozen=True)
class SiteScenario:
    id: str
    name: str
    currency: str
    duration_s: int
    step_s: int
    it_demand_kw: Decimal
    it_capacity_kw: Decimal
    distribution_efficiency: Decimal
    tariff_per_kwh: Decimal | None
    generator_cost_per_kwh: Decimal | None
    generator_start_delay_s: int
    battery_capacity_kwh: Decimal
    battery_initial_kwh: Decimal
    battery_charge_kw: Decimal
    battery_charge_efficiency: Decimal
    battery_discharge_efficiency: Decimal
    source_ids: tuple[str, ...]
    assets: tuple[Asset, ...]
    dependencies: tuple[Dependency, ...]
    events: tuple[Event, ...]

    def __post_init__(self):
        _text(self.id, "id")
        _text(self.name, "name")
        if self.currency not in ("USD", "EUR", "INR"):
            raise InputError("currency: expected USD, EUR or INR; no FX conversion")
        bounded_integer(self.duration_s, "duration_s", 1, 86400)
        bounded_integer(self.step_s, "step_s", 1, 3600)
        if self.duration_s > self.step_s * 2000:
            raise InputError("Requested time resolution exceeds 2000 regular intervals")
        bounded_integer(self.generator_start_delay_s, "generator_start_delay_s", 0, 86400)
        for field in ("it_demand_kw", "battery_initial_kwh", "battery_charge_kw"):
            object.__setattr__(self, field, number(getattr(self, field), field))
        for field in ("it_capacity_kw", "battery_capacity_kwh"):
            object.__setattr__(self, field, number(getattr(self, field), field, positive=True))
        for field in ("distribution_efficiency", "battery_charge_efficiency", "battery_discharge_efficiency"):
            object.__setattr__(self, field, fraction_value(getattr(self, field), field))
        for field in ("tariff_per_kwh", "generator_cost_per_kwh"):
            value = getattr(self, field)
            object.__setattr__(self, field, None if value is None else number(value, field))
        if self.battery_initial_kwh > self.battery_capacity_kwh:
            raise InputError("battery_initial_kwh exceeds stored-energy capacity")
        object.__setattr__(self, "source_ids", string_list(self.source_ids, "source_ids"))
        for field, kind, maximum in (
            ("assets", Asset, 64),
            ("dependencies", Dependency, 256),
            ("events", Event, 128),
        ):
            values = getattr(self, field)
            if (
                not isinstance(values, (tuple, list))
                or len(values) > maximum
                or any(not isinstance(v, kind) for v in values)
            ):
                raise InputError(f"{field}: expected at most {maximum} {kind.__name__} records")
            object.__setattr__(self, field, tuple(values))
        by_id = {asset.id: asset for asset in self.assets}
        if len(by_id) != len(self.assets):
            raise InputError("Asset identifiers must be unique")
        for kind in ("utility", "generator", "battery", "load"):
            if sum(asset.kind == kind for asset in self.assets) != 1:
                raise InputError(f"This model requires exactly one {kind} asset")
        battery = next(asset for asset in self.assets if asset.kind == "battery")
        if self.battery_charge_kw > battery.capacity_kw:
            raise InputError("battery_charge_kw exceeds the battery electrical power rating")
        domains = {domain for asset in self.assets for domain in asset.failure_domains}
        seen = set()
        for edge in self.dependencies:
            if edge.source not in by_id or edge.target not in by_id:
                raise InputError("Dependency refers to a missing asset")
            key = (edge.source, edge.target, edge.relation)
            if key in seen:
                raise InputError("Duplicate dependency")
            seen.add(key)
            if edge.relation == "feeds":
                if (
                    by_id[edge.target].kind in ("utility", "generator", "battery")
                    or by_id[edge.source].kind == "load"
                ):
                    raise InputError("Feeds must lead from sources toward the load")
            if edge.relation == "charges" and (
                by_id[edge.target].kind != "battery"
                or by_id[edge.source].kind != "bus"
            ):
                raise InputError("Charging connections must lead from a bus to the battery")
        if sum(edge.relation == "charges" for edge in self.dependencies) != 1:
            raise InputError("Provide exactly one explicit bus-to-battery charging connection")
        topological_order(self.assets, self.dependencies, "feeds")
        topological_order(self.assets, self.dependencies, "requires")
        # Disconnected source paths are configuration errors; outage disconnections are simulated events.
        load = next(asset.id for asset in self.assets if asset.kind == "load")
        charging_bus = next(edge.source for edge in self.dependencies if edge.relation == "charges")
        source_ids = (
            asset.id
            for asset in self.assets
            if asset.kind in ("utility", "generator", "battery")
        )
        for source in source_ids:
            reachable = {source}
            for item in topological_order(self.assets, self.dependencies, "feeds"):
                if item in reachable:
                    reachable.update(
                        edge.target
                        for edge in self.dependencies
                        if edge.source == item and edge.relation == "feeds"
                    )
            if load not in reachable:
                raise InputError(f"Source {source} has no feed path to the load")
            if by_id[source].kind == "utility" and charging_bus not in reachable:
                raise InputError("The charging bus has no utility feed path")
        for event in self.events:
            if event.at_s >= self.duration_s:
                raise InputError("Events must occur before the simulation end")
            valid_targets = domains if event.action.startswith("domain_") else by_id
            if event.target not in valid_targets:
                raise InputError("Event refers to an unknown asset or failure domain")
            if event.action == "set_demand" and event.target != load:
                raise InputError("set_demand must target the load asset")

    @classmethod
    def from_dict(cls, data):
        fields = set(cls.__dataclass_fields__)
        _keys(data, fields | {"schema_version"}, "continuity scenario")
        if type(data["schema_version"]) is not int or data["schema_version"] != 2:
            raise InputError(
                "Electrical continuity requires schema_version 2; "
                "v1 PUE scenarios cannot infer topology"
            )
        values = {key: value for key, value in data.items() if key != "schema_version"}
        for field, kind, maximum in (
            ("assets", Asset, 64),
            ("dependencies", Dependency, 256),
            ("events", Event, 128),
        ):
            if not isinstance(values[field], list) or len(values[field]) > maximum:
                raise InputError(f"{field}: expected a bounded JSON array")
            values[field] = tuple(kind.from_dict(item) for item in values[field])
        return cls(**values)

    def to_dict(self):
        result = {"schema_version": 2}
        for field in self.__dataclass_fields__:
            value = getattr(self, field)
            if isinstance(value, Decimal):
                value = decimal_text(value)
            elif field in ("assets", "dependencies", "events"):
                value = [item.to_dict() for item in value]
            elif isinstance(value, tuple):
                value = list(value)
            result[field] = value
        return result
