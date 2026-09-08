"""Version 1 input contract. JSON quantities use decimal strings and named units."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
from typing import Any

MAX_SCENARIO_BYTES = 4 * 1024 * 1024


class InputError(ValueError):
    """An actionable contract or supported-envelope violation."""


def number(value: Any, name: str, *, positive: bool = False) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise InputError(f"{name}: expected a finite decimal number")
    try:
        text = str(value)
        if len(text) > 128:
            raise InputError(f"{name}: numeric representation is too long")
        result = Decimal(text)
    except (InvalidOperation, ValueError) as exc:
        raise InputError(f"{name}: expected a finite decimal number") from exc
    if not result.is_finite():
        raise InputError(f"{name}: NaN and infinity are not supported")
    if result < 0 or (positive and result == 0):
        raise InputError(f"{name}: must be {'positive' if positive else 'nonnegative'}")
    # Computational bounds, not equipment ratings or engineering design limits.
    if result > Decimal('1e12') or result.as_tuple().exponent < -9:
        raise InputError(f"{name}: maximum 1e12 with at most nine decimal places")
    return result


def decimal_text(value: Decimal) -> str:
    if value == 0:
        return "0"
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def _text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > 200:
        raise InputError(f"{name}: expected nonempty text of at most 200 characters")
    return value


def _keys(data: Any, required: set[str], name: str) -> None:
    if not isinstance(data, dict):
        raise InputError(f"{name}: expected an object")
    if any(not isinstance(key, str) for key in data):
        raise InputError(f"{name}: field names must be strings")
    missing, extra = required - data.keys(), data.keys() - required
    if missing or extra:
        raise InputError(f"{name}: missing fields {sorted(missing)}; unknown fields {sorted(extra)}")


@dataclass(frozen=True)
class Segment:
    label: str
    hours: Decimal
    it_load_kw: Decimal
    assumed_pue: Decimal

    def __post_init__(self) -> None:
        _text(self.label, "label")
        object.__setattr__(self, "hours", number(self.hours, "hours", positive=True))
        object.__setattr__(self, "it_load_kw", number(self.it_load_kw, "it_load_kw"))
        pue = number(self.assumed_pue, "assumed_pue", positive=True)
        if pue < 1:
            raise InputError("assumed_pue: must be at least 1 in the coarse energy boundary")
        object.__setattr__(self, "assumed_pue", pue)

    @classmethod
    def from_dict(cls, data: Any) -> 'Segment':
        _keys(data, {"label", "hours", "it_load_kw", "assumed_pue"}, "segment")
        return cls(**data)

    def to_dict(self) -> dict:
        return {"label": self.label, "hours": decimal_text(self.hours),
                "it_load_kw": decimal_text(self.it_load_kw),
                "assumed_pue": decimal_text(self.assumed_pue)}


@dataclass(frozen=True)
class Scenario:
    id: str
    name: str
    currency: str
    it_capacity_kw: Decimal
    tariff_per_kwh: Decimal | None
    price_status: str
    assumption_date: str
    source_ids: tuple[str, ...]
    segments: tuple[Segment, ...]

    def __post_init__(self) -> None:
        _text(self.id, "id")
        _text(self.name, "name")
        if self.currency not in ("USD", "EUR", "INR"):
            raise InputError("currency: use USD, EUR, or INR; automatic FX is not implemented")
        if self.price_status not in ("illustrative", "unknown"):
            raise InputError("price_status: the preliminary contract supports illustrative or unknown")
        tariff = None if self.tariff_per_kwh is None else number(self.tariff_per_kwh, "tariff_per_kwh")
        if (tariff is None) != (self.price_status == "unknown"):
            raise InputError("tariff_per_kwh: null must have unknown status; a value must be illustrative")
        try:
            date_value = self.assumption_date
            if not isinstance(date_value, str) or date.fromisoformat(date_value).isoformat() != date_value:
                raise ValueError
        except (ValueError, TypeError):
            raise InputError("assumption_date: use a valid YYYY-MM-DD date") from None
        sources = self.source_ids
        if not isinstance(sources, (list, tuple)) or not sources or len(sources) > 100:
            raise InputError("source_ids: expected 1 to 100 reference identifiers")
        if not isinstance(self.segments, (list, tuple)) or len(self.segments) > 10000:
            raise InputError("segments: expected at most 10000 Segment instances")
        if any(not isinstance(segment, Segment) for segment in self.segments):
            raise InputError("segments: expected Segment instances; use from_dict for JSON objects")
        object.__setattr__(self, "it_capacity_kw", number(self.it_capacity_kw, "it_capacity_kw", positive=True))
        object.__setattr__(self, "tariff_per_kwh", tariff)
        object.__setattr__(self, "source_ids", tuple(_text(s, "source_id") for s in sources))
        object.__setattr__(self, "segments", tuple(self.segments))

    @classmethod
    def from_dict(cls, data: Any) -> 'Scenario':
        _keys(data, {"schema_version", "id", "name", "currency", "it_capacity_kw",
                     "tariff_per_kwh", "price_status", "assumption_date", "source_ids", "segments"},
              "scenario")
        if type(data["schema_version"]) is not int or data["schema_version"] != 1:
            raise InputError("schema_version: only integer 1 is supported")
        if not isinstance(data["source_ids"], list):
            raise InputError("source_ids: expected a JSON list")
        if not isinstance(data["segments"], list) or len(data["segments"]) > 10000:
            raise InputError("segments: expected a list with at most 10000 intervals")
        return cls(data["id"], data["name"], data["currency"], data["it_capacity_kw"],
                   data["tariff_per_kwh"], data["price_status"], data["assumption_date"],
                   data["source_ids"], tuple(Segment.from_dict(s) for s in data["segments"]))

    def to_dict(self) -> dict:
        return {"schema_version": 1, "id": self.id, "name": self.name, "currency": self.currency,
                "it_capacity_kw": decimal_text(self.it_capacity_kw),
                "tariff_per_kwh": None if self.tariff_per_kwh is None else decimal_text(self.tariff_per_kwh),
                "price_status": self.price_status, "assumption_date": self.assumption_date,
                "source_ids": list(self.source_ids), "segments": [s.to_dict() for s in self.segments]}


def _unique_object(pairs: list[tuple[str, Any]]) -> dict:
    data = {}
    for key, value in pairs:
        if key in data:
            raise InputError(f"Duplicate JSON field: {key}")
        data[key] = value
    return data


def parse_json_document(content: bytes):
    if len(content) > MAX_SCENARIO_BYTES:
        raise InputError("Scenario file exceeds the 4 MiB input limit")
    try:
        return json.loads(content.decode("utf-8-sig"), parse_float=Decimal, object_pairs_hook=_unique_object)
    except RecursionError as exc:
        raise InputError("Scenario JSON is nested too deeply") from exc
    except (UnicodeError, ValueError) as exc:
        raise InputError(f"Invalid scenario JSON: {exc}") from exc


def load_json_document(path: str | Path):
    source = Path(path)
    if not source.is_file():
        raise InputError(f"Scenario must be an existing regular file: {source}")
    with source.open("rb") as handle:
        content = handle.read(MAX_SCENARIO_BYTES + 1)
    return parse_json_document(content)


def load_scenario(path: str | Path) -> Scenario:
    return Scenario.from_dict(load_json_document(path))
