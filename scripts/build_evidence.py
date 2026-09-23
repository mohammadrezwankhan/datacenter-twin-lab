"""Build or verify a reproducible synthetic continuity evidence packet.

The numerical expectations in this module are reconstructed from the scenario
inputs with exact Fractions. Engine residual fields are never used for ledger
verification. Packet files avoid timestamps, local paths, and inferred Git
metadata; runtime details live in a separate environment metadata file.
"""

from __future__ import annotations

import argparse
from decimal import Context, Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction
import hashlib
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import platform
import re
import sys
import tempfile
from typing import Any
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from datacenter_twin import __version__  # noqa: E402
from datacenter_twin.contracts import InputError, decimal_text  # noqa: E402
from datacenter_twin.continuity import simulate_continuity  # noqa: E402
from datacenter_twin.demo import demo_scenario  # noqa: E402
from datacenter_twin.reporting import render_html, render_markdown  # noqa: E402
from datacenter_twin.topology import SiteScenario  # noqa: E402


ARITHMETIC = Context(prec=100, rounding=ROUND_HALF_EVEN)
LEDGER_TOLERANCE_KWH = Fraction(1, 10**90)
MANIFEST_NAME = "manifest.json"
MAX_MANIFEST_BYTES = 1024 * 1024
MAX_ENVIRONMENT_BYTES = 32 * 1024
MAX_ARTIFACT_BYTES = 4 * 1024 * 1024
MAX_PACKET_ENTRIES = 32


def _json_text(value: Any) -> str:
    return json.dumps(value, sort_keys=True, indent=2, ensure_ascii=True, allow_nan=False) + "\n"


def _unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise InputError(f"Duplicate JSON object key in evidence packet: {key}")
        result[key] = value
    return result


def _fraction(value: Any) -> Fraction:
    """Interpret a decimal input/output string as its exact rational value."""
    if isinstance(value, bool) or value is None:
        raise InputError("Expected a finite decimal value for independent reconstruction")
    return Fraction(Decimal(str(value)))


def _format_fraction(value: Fraction) -> str:
    with localcontext(ARITHMETIC):
        return decimal_text(Decimal(value.numerator) / Decimal(value.denominator))


def _receipt_value(value: str) -> str:
    """Keep the one-page receipt compact; full precision remains in packet JSON."""
    exact = _fraction(value)
    with localcontext(Context(prec=14, rounding=ROUND_HALF_EVEN)):
        displayed = decimal_text(Decimal(exact.numerator) / Decimal(exact.denominator))
    if Fraction(Decimal(displayed)) != exact:
        displayed += "…"
    return displayed


def _course_ride_through(initial_kwh: str) -> SiteScenario:
    """Recreate lessonScenario(ride-through, generator_failure, value) exactly."""
    data = demo_scenario("generator_failure").to_dict()
    data["id"] = "course-ride-through"
    data["name"] = "3. Calculate battery ride-through"
    data["source_ids"] = list(dict.fromkeys([*data["source_ids"], "EDU-POWER-001"]))
    data["battery_charge_kw"] = "0"
    data["battery_initial_kwh"] = initial_kwh
    return SiteScenario.from_dict(data)


def _event_time(scenario: SiteScenario, *, action: str, target: str) -> Fraction:
    found = [event.at_s for event in scenario.events if event.action == action and event.target == target]
    if len(found) != 1:
        raise InputError(f"Independent calculation expected one {action} event for {target}")
    return Fraction(found[0])


def _ride_through_expectations(scenario: SiteScenario) -> dict[str, Fraction]:
    outage_start = _event_time(scenario, action="asset_down", target="utility")
    recovery = _event_time(scenario, action="asset_up", target="utility")
    deliverable_kwh = (
        Fraction(scenario.battery_initial_kwh)
        * Fraction(scenario.battery_discharge_efficiency)
        * Fraction(scenario.distribution_efficiency)
    )
    ride_through_s = deliverable_kwh / Fraction(scenario.it_demand_kw) * 3600
    depletion_elapsed_s = outage_start + ride_through_s
    unserved_duration_s = max(Fraction(0), recovery - depletion_elapsed_s)
    return {
        "requested_it_kwh": Fraction(scenario.it_demand_kw) * scenario.duration_s / 3600,
        "ride_through_s": ride_through_s,
        "depletion_elapsed_s": depletion_elapsed_s,
        "unserved_duration_s": unserved_duration_s,
        "unserved_it_kwh": Fraction(scenario.it_demand_kw) * unserved_duration_s / 3600,
    }


def _path_maintenance_expectations(scenario: SiteScenario) -> dict[str, Fraction]:
    failed_path = next(
        event.target for event in scenario.events
        if event.action == "asset_down" and event.target.startswith("path-")
    )
    surviving_gross_kw = sum(
        (Fraction(asset.capacity_kw) for asset in scenario.assets
         if asset.kind == "distribution" and asset.id != failed_path),
        Fraction(0),
    )
    outage_start = _event_time(scenario, action="asset_down", target=failed_path)
    recovery = _event_time(scenario, action="asset_up", target=failed_path)
    served_kw = surviving_gross_kw * Fraction(scenario.distribution_efficiency)
    unserved_kw = Fraction(scenario.it_demand_kw) - served_kw
    outage_s = recovery - outage_start
    return {
        "requested_it_kwh": Fraction(scenario.it_demand_kw) * scenario.duration_s / 3600,
        "served_kw_during_maintenance": served_kw,
        "unserved_kw_during_maintenance": unserved_kw,
        "unserved_duration_s": outage_s,
        "unserved_it_kwh": unserved_kw * outage_s / 3600,
    }


def _check_row(
    *, case_id: str, metric: str, equation: str, expected: Fraction, observed: Any, unit: str
) -> dict[str, str]:
    actual = _fraction(observed)
    difference = abs(actual - expected)
    if difference > LEDGER_TOLERANCE_KWH:
        raise InputError(
            f"{case_id}.{metric}: observed {observed} {unit}, expected "
            f"{_format_fraction(expected)} {unit} from {equation}"
        )
    return {
        "metric": metric,
        "equation": equation,
        "expected": _format_fraction(expected),
        "observed": str(observed),
        "unit": unit,
        "difference": _format_fraction(difference),
        "status": "match",
    }


def _independent_ledger(run: dict) -> dict[str, Any]:
    """Rebuild whole-run energy identities from exported interval terms only."""
    totals = {
        key: Fraction(0)
        for key in (
            "requested_it_kwh", "served_it_kwh", "unserved_it_kwh", "grid_kwh",
            "generator_kwh", "battery_stored_change_kwh", "distribution_loss_kwh",
            "battery_charge_loss_kwh", "battery_discharge_loss_kwh",
        )
    }
    max_interval_source_difference = Fraction(0)
    max_interval_request_difference = Fraction(0)
    max_interval_storage_difference = Fraction(0)
    for row in run["intervals"]:
        energy = {key: _fraction(row["energy"][key]) for key in totals}
        for key, value in energy.items():
            totals[key] += value
        source = energy["grid_kwh"] + energy["generator_kwh"]
        accounted = sum(
            (energy[key] for key in (
                "served_it_kwh", "battery_stored_change_kwh", "distribution_loss_kwh",
                "battery_charge_loss_kwh", "battery_discharge_loss_kwh",
            )),
            Fraction(0),
        )
        request_partition = (
            energy["requested_it_kwh"] - energy["served_it_kwh"] - energy["unserved_it_kwh"]
        )
        storage_difference = (
            _fraction(row["battery_end_kwh"])
            - _fraction(row["battery_start_kwh"])
            - energy["battery_stored_change_kwh"]
        )
        max_interval_source_difference = max(
            max_interval_source_difference, abs(source - accounted)
        )
        max_interval_request_difference = max(
            max_interval_request_difference, abs(request_partition)
        )
        max_interval_storage_difference = max(
            max_interval_storage_difference, abs(storage_difference)
        )

    source_difference = totals["grid_kwh"] + totals["generator_kwh"] - sum(
        (totals[key] for key in (
            "served_it_kwh", "battery_stored_change_kwh", "distribution_loss_kwh",
            "battery_charge_loss_kwh", "battery_discharge_loss_kwh",
        )),
        Fraction(0),
    )
    request_difference = (
        totals["requested_it_kwh"] - totals["served_it_kwh"] - totals["unserved_it_kwh"]
    )
    final_energy_difference = (
        _fraction(run["intervals"][-1]["battery_end_kwh"])
        - _fraction(run["intervals"][0]["battery_start_kwh"])
        - totals["battery_stored_change_kwh"]
    )
    discrepancies = {
        "whole_run_source_balance_kwh": abs(source_difference),
        "whole_run_requested_partition_kwh": abs(request_difference),
        "whole_run_battery_balance_kwh": abs(final_energy_difference),
        "maximum_interval_source_balance_kwh": max_interval_source_difference,
        "maximum_interval_requested_partition_kwh": max_interval_request_difference,
        "maximum_interval_battery_balance_kwh": max_interval_storage_difference,
    }
    if any(value > LEDGER_TOLERANCE_KWH for value in discrepancies.values()):
        raise InputError(
            "Independent whole-run energy ledger exceeded the stated "
            f"{_format_fraction(LEDGER_TOLERANCE_KWH)} kWh rounding tolerance"
        )
    return {
        "method": (
            "Exact Fraction sums of exported interval energy terms; the run's "
            "energy_balance_residual_kwh fields are ignored."
        ),
        "tolerance_kwh": _format_fraction(LEDGER_TOLERANCE_KWH),
        "checks": {
            key: _format_fraction(value) for key, value in discrepancies.items()
        },
        "status": "pass",
    }


def _build_case(case_id: str, scenario: SiteScenario, kind: str) -> dict[str, Any]:
    run = simulate_continuity(scenario).to_dict()
    input_sha256 = run["input_sha256"]
    ledger = _independent_ledger(run)
    if kind == "ride-through":
        expected = _ride_through_expectations(scenario)
        depletion = next(
            event["at_s"] for event in run["events"] if event["action"] == "battery_depleted"
        )
        outage_start = _event_time(scenario, action="asset_down", target="utility")
        observed = {
            "requested_it_kwh": run["summary"]["requested_it_kwh"],
            "ride_through_s": _format_fraction(_fraction(depletion) - outage_start),
            "depletion_elapsed_s": depletion,
            "unserved_duration_s": run["summary"]["unserved_duration_s"],
            "unserved_it_kwh": run["summary"]["unserved_it_kwh"],
        }
        initial = _format_fraction(Fraction(scenario.battery_initial_kwh))
        outage_start_s = _format_fraction(outage_start)
        recovery_s = _format_fraction(_event_time(scenario, action="asset_up", target="utility"))
        deliverable = Fraction(scenario.battery_initial_kwh) * Fraction(
            scenario.battery_discharge_efficiency
        ) * Fraction(scenario.distribution_efficiency)
        equations = {
            "requested_it_kwh": (
                f"{scenario.it_demand_kw} kW × {scenario.duration_s} s ÷ 3,600"
            ),
            "ride_through_s": (
                f"({initial} kWh × {scenario.battery_discharge_efficiency} × "
                f"{scenario.distribution_efficiency}) ÷ {scenario.it_demand_kw} kW × 3,600"
            ),
            "depletion_elapsed_s": f"{outage_start_s} s outage start + ride-through",
            "unserved_duration_s": f"{recovery_s} s recovery − depletion elapsed",
            "unserved_it_kwh": f"{scenario.it_demand_kw} kW × unserved seconds ÷ 3,600",
        }
        units = {
            "requested_it_kwh": "kWh", "ride_through_s": "s", "depletion_elapsed_s": "s",
            "unserved_duration_s": "s", "unserved_it_kwh": "kWh",
        }
        checks = [
            _check_row(
                case_id=case_id, metric=metric, equation=equations[metric],
                expected=expected[metric], observed=observed[metric], unit=units[metric],
            )
            for metric in expected
        ]
        if deliverable <= 0:
            raise InputError("Independent ride-through calculation expected positive deliverable energy")
    elif kind == "path-maintenance":
        expected = _path_maintenance_expectations(scenario)
        outage_start = _event_time(
            scenario,
            action="asset_down",
            target=next(event.target for event in scenario.events if event.action == "asset_down"),
        )
        row = next(
            interval for interval in run["intervals"]
            if _fraction(interval["start_s"]) == outage_start
        )
        observed = {
            "requested_it_kwh": run["summary"]["requested_it_kwh"],
            "served_kw_during_maintenance": row["served_it_kw"],
            "unserved_kw_during_maintenance": row["unserved_it_kw"],
            "unserved_duration_s": run["summary"]["unserved_duration_s"],
            "unserved_it_kwh": run["summary"]["unserved_it_kwh"],
        }
        failed_path = next(
            event.target for event in scenario.events if event.action == "asset_down"
        )
        gross_kw = sum(
            (Fraction(asset.capacity_kw) for asset in scenario.assets
             if asset.kind == "distribution" and asset.id != failed_path),
            Fraction(0),
        )
        recovery_s = _format_fraction(_event_time(scenario, action="asset_up", target=failed_path))
        equations = {
            "requested_it_kwh": (
                f"{scenario.it_demand_kw} kW × {scenario.duration_s} s ÷ 3,600"
            ),
            "served_kw_during_maintenance": (
                f"{_format_fraction(gross_kw)} gross kW × "
                f"{scenario.distribution_efficiency} distribution efficiency"
            ),
            "unserved_kw_during_maintenance": (
                f"{scenario.it_demand_kw} kW requested − served kW"
            ),
            "unserved_duration_s": f"{recovery_s} s recovery − { _format_fraction(outage_start) } s outage start",
            "unserved_it_kwh": "unserved kW × unserved seconds ÷ 3,600",
        }
        units = {
            "requested_it_kwh": "kWh", "served_kw_during_maintenance": "kW",
            "unserved_kw_during_maintenance": "kW", "unserved_duration_s": "s",
            "unserved_it_kwh": "kWh",
        }
        checks = [
            _check_row(
                case_id=case_id, metric=metric, equation=equations[metric],
                expected=expected[metric], observed=observed[metric], unit=units[metric],
            )
            for metric in expected
        ]
    else:
        raise InputError(f"Unknown evidence case kind: {kind}")

    scenario_name = f"scenario-{case_id}-{input_sha256}.json"
    run_name = f"run-{case_id}-{input_sha256}.json"
    markdown_name = f"report-{case_id}-{input_sha256}.md"
    html_name = f"report-{case_id}-{input_sha256}.html"
    files = {
        scenario_name: _json_text(scenario.to_dict()),
        run_name: _json_text(run),
        markdown_name: render_markdown(run),
        html_name: render_html(run),
    }
    return {
        "case_id": case_id,
        "scenario_id": scenario.id,
        "input_sha256": input_sha256,
        "run_id": run["run_id"],
        "scenario_file": scenario_name,
        "run_file": run_name,
        "markdown_report_file": markdown_name,
        "html_report_file": html_name,
        "checks": checks,
        "ledger": ledger,
        "files": files,
    }


def _cases() -> list[dict[str, Any]]:
    ride_100 = _course_ride_through("100")
    ride_50 = _course_ride_through("50")
    path = demo_scenario("path_maintenance")
    return [
        _build_case("canonical-1mw-100kwh", ride_100, "ride-through"),
        _build_case("canonical-1mw-50kwh", ride_50, "ride-through"),
        _build_case("path-maintenance-700kw", path, "path-maintenance"),
    ]


def _environment_metadata() -> dict[str, str]:
    return {
        "engine_version": __version__,
        "python_implementation": platform.python_implementation(),
        "python_version": platform.python_version(),
        "operating_system": platform.system(),
        "operating_system_release": platform.release(),
        "machine_architecture": platform.machine(),
    }


def _render_receipt(cases: list[dict[str, Any]], context: dict[str, str]) -> str:
    lines = [
        "# Synthetic continuity reproduction receipt",
        "",
        f"Engine version: `{__version__}`.",
        "",
        "This is maintainer-generated synthetic evidence. Independent external review: **not obtained**.",
        "No facility, equipment, cooling, workload, certification, or physical-control behavior is validated.",
        "",
    ]
    if context:
        lines.append("Public context supplied by the packet operator:")
        lines.extend(f"- {key}: `{value}`" for key, value in sorted(context.items()))
        lines.append("")
    lines.extend([
        "| Case | Input SHA-256 | Run ID |",
        "| --- | --- | --- |",
    ])
    for case in cases:
        lines.append(
            f"| `{case['case_id']}` | `{case['input_sha256']}` | `{case['run_id']}` |"
        )
    for case in cases:
        lines.extend(["", f"## {case['case_id']}", ""])
        lines.extend([
            "| Measure | Independent equation | Expected | Observed |",
            "| --- | --- | --- | --- |",
        ])
        for check in case["checks"]:
            lines.append(
                f"| {check['metric']} ({check['unit']}) | {check['equation']} | "
                f"{_receipt_value(check['expected'])} | {_receipt_value(check['observed'])} |"
            )
        lines.append(
            "Independent interval-ledger reconstruction: **pass**; maximum tolerated "
            f"rounding difference `{case['ledger']['tolerance_kwh']} kWh`. "
            "It sums the exported interval terms and ignores the engine residual fields."
        )
    lines.extend([
        "",
        "Receipt values show at most 14 significant digits; an ellipsis marks additional digits. "
        "The scenario/run JSON retain full numeric strings from the engine's 100-significant-digit, "
        "round-half-even context. "
        "Independent rational values are compared with a maximum absolute tolerance of "
        f"`{_format_fraction(LEDGER_TOLERANCE_KWH)} kWh` (also used numerically for time and power checks).",
        "Runtime details are in `environment.json`; scenario, run, reports, and this receipt "
        "are deterministic numerical artifacts for the same inputs and engine version.",
        "See `manifest.json` for per-file SHA-256 values; its own digest is printed by the builder.",
        "",
    ])
    return "\n".join(lines)


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_public_context(revision: str | None, repository: str | None) -> dict[str, str]:
    context = {}
    for key, value in (("revision", revision), ("repository", repository)):
        if value is None:
            continue
        if (
            not isinstance(value, str)
            or not value.strip()
            or len(value) > 300
            or any(ord(char) < 32 for char in value)
        ):
            raise InputError(f"--{key} must be a nonempty public context value of at most 300 characters")
        if key == "revision":
            if (
                "\\" in value
                or value.startswith(("/", "~"))
                or ":" in value
                or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", value)
                or any(part in ("", ".", "..") for part in value.split("/"))
            ):
                raise InputError("--revision must be a public commit or tag, not a path")
        else:
            if "\\" in value or any(char.isspace() for char in value):
                raise InputError("--repository must be a public repository identifier or HTTPS URL")
            try:
                parsed = urlsplit(value)
            except ValueError as exc:
                raise InputError(
                    "--repository must be a public repository identifier or HTTPS URL"
                ) from exc
            if parsed.scheme:
                if (
                    parsed.scheme != "https"
                    or not parsed.hostname
                    or parsed.username is not None
                    or parsed.password is not None
                    or parsed.query
                    or parsed.fragment
                    or len([part for part in parsed.path.split("/") if part]) < 2
                ):
                    raise InputError("--repository must be a public repository identifier or HTTPS URL")
            elif (
                ":" in value
                or value.startswith(("/", "~", "."))
                or len(value.split("/")) != 2
                or any(not re.fullmatch(r"[A-Za-z0-9_.-]+", part) for part in value.split("/"))
                or any(part in (".", "..") for part in value.split("/"))
            ):
                raise InputError("--repository must be an owner/name identifier or HTTPS URL")
        context[key] = value
    return context


def _packet_artifacts(
    *, revision: str | None = None, repository: str | None = None
) -> dict[str, str]:
    context = _safe_public_context(revision, repository)
    cases = _cases()
    artifacts: dict[str, str] = {}
    manifest_cases = []
    for case in cases:
        artifacts.update(case.pop("files"))
        manifest_cases.append({key: value for key, value in case.items()})
    artifacts["receipt.md"] = _render_receipt(manifest_cases, context)
    artifacts["environment.json"] = _json_text(_environment_metadata())
    classifications = {
        name: "environment_metadata" if name == "environment.json" else "deterministic_numerical_artifact"
        for name in artifacts
    }
    manifest = {
        "schema_version": 1,
        "packet_type": "datacenter-twin-lab-independent-reproduction",
        "engine_version": __version__,
        "public_context": context,
        "independent_review": {"status": "not_obtained", "reviewer": None},
        "rounding": {
            "engine_decimal_context": "100 significant digits, ROUND_HALF_EVEN",
            "comparison_absolute_tolerance": _format_fraction(LEDGER_TOLERANCE_KWH),
            "tolerance_unit_for_energy_ledger": "kWh",
        },
        "artifact_classification": classifications,
        "cases": manifest_cases,
        "artifacts": {
            name: {"sha256": _sha256_text(content), "classification": classifications[name]}
            for name, content in sorted(artifacts.items())
        },
        "manifest_hash_scope": (
            "Artifacts map covers every packet file except manifest.json itself. "
            "Record the builder-printed manifest digest separately when pinning a packet."
        ),
    }
    artifacts[MANIFEST_NAME] = _json_text(manifest)
    return artifacts


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _has_link_component(path: Path) -> bool:
    absolute = path.absolute()
    candidates = (absolute, *absolute.parents)
    for candidate in candidates:
        if candidate.is_symlink():
            return True
        is_junction = getattr(candidate, "is_junction", None)
        if is_junction is not None and is_junction():
            return True
    return False


def _validate_destination(destination: Path) -> Path:
    destination = Path(destination).expanduser()
    if destination.is_symlink():
        raise InputError("Evidence destination must not be a symbolic link")
    resolved = destination.resolve()
    if resolved == ROOT:
        raise InputError("Evidence destination must not be the repository root")
    if _is_within(resolved, ROOT):
        output_root = (ROOT / "outputs").resolve()
        if not _is_within(resolved, output_root):
            raise InputError("Evidence destination inside the repository must be under outputs/")
    if destination.exists():
        raise InputError("Evidence destination already exists; choose a fresh directory")
    return destination


def build_packet(
    destination: Path, *, revision: str | None = None, repository: str | None = None
) -> dict[str, Any]:
    """Write a complete packet to a fresh directory and return its public receipt."""
    destination = _validate_destination(destination)
    artifacts = _packet_artifacts(revision=revision, repository=repository)
    destination.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=f".{destination.name}.", dir=destination.parent))
    created: list[Path] = []
    published: list[Path] = []
    destination_created = False
    try:
        for name, content in artifacts.items():
            from datacenter_twin.output import write_result
            write_result(stage / name, content)
            created.append(stage / name)
        if destination.is_symlink() or destination.exists():
            raise InputError("Evidence destination appeared while building; no files were replaced")
        try:
            destination.mkdir()
        except FileExistsError as exc:
            raise InputError("Evidence destination appeared while building; no files were replaced") from exc
        destination_created = True
        for name in artifacts:
            source = stage / name
            target = destination / name
            os.link(source, target)
            published.append(target)
    except Exception:
        for path in published:
            path.unlink(missing_ok=True)
        if destination_created:
            try:
                destination.rmdir()
            except OSError:
                pass
        raise
    finally:
        for path in created:
            path.unlink(missing_ok=True)
        try:
            stage.rmdir()
        except OSError:
            pass
    manifest_sha256 = _sha256_text(artifacts[MANIFEST_NAME])
    return {
        "destination": destination,
        "manifest_sha256": manifest_sha256,
        "artifact_count": len(artifacts) - 1,
        "cases": 3,
    }


def verify_packet(directory: Path) -> dict[str, Any]:
    """Check hashes, schema, and byte-for-byte current-engine reproduction."""
    directory = Path(directory).expanduser()
    if _has_link_component(directory) or not directory.is_dir():
        raise InputError("Evidence packet must be a regular, non-symbolic-link directory")
    manifest_path = directory / MANIFEST_NAME
    if manifest_path.is_symlink() or not manifest_path.is_file():
        raise InputError("Evidence packet is missing a regular manifest.json")
    if manifest_path.stat().st_size > MAX_MANIFEST_BYTES:
        raise InputError("Evidence manifest exceeds the supported size limit")
    try:
        manifest = json.loads(
            manifest_path.read_text(encoding="utf-8"), object_pairs_hook=_unique_json_object
        )
    except (OSError, json.JSONDecodeError) as exc:
        raise InputError(f"Cannot read evidence manifest: {exc}") from exc
    artifacts = manifest.get("artifacts") if isinstance(manifest, dict) else None
    if not isinstance(artifacts, dict):
        raise InputError("Evidence manifest has no per-file artifacts map")
    for name in artifacts:
        if not isinstance(name, str) or name == MANIFEST_NAME:
            raise InputError(f"Invalid artifact path in manifest: {name}")
        relative = PurePosixPath(name)
        windows_relative = PureWindowsPath(name)
        if (
            relative.is_absolute()
            or windows_relative.is_absolute()
            or windows_relative.drive
            or "\\" in name
            or ":" in name
            or ".." in relative.parts
            or len(relative.parts) != 1
        ):
            raise InputError(f"Unsafe artifact path in manifest: {name}")
    expected_names = set(artifacts) | {MANIFEST_NAME}
    actual_names = set()
    for item in directory.iterdir():
        if item.is_symlink() or not item.is_file():
            raise InputError(f"Evidence packet contains a non-regular file: {item.name}")
        if item.stat().st_size > MAX_ARTIFACT_BYTES:
            raise InputError(f"Evidence artifact exceeds the supported size limit: {item.name}")
        actual_names.add(item.name)
        if len(actual_names) > MAX_PACKET_ENTRIES:
            raise InputError("Evidence packet contains too many files")
    if actual_names != expected_names:
        missing = sorted(expected_names - actual_names)
        extra = sorted(actual_names - expected_names)
        raise InputError(f"Evidence packet file set differs from manifest (missing={missing}, extra={extra})")
    for name, entry in artifacts.items():
        if (
            not isinstance(entry, dict)
            or set(entry) != {"sha256", "classification"}
            or not isinstance(entry.get("sha256"), str)
            or not re.fullmatch(r"[a-f0-9]{64}", entry["sha256"])
        ):
            raise InputError(f"Invalid manifest checksum record: {name}")
        digest = _sha256_file(directory / name)
        if digest != entry["sha256"]:
            raise InputError(f"SHA-256 mismatch for evidence artifact: {name}")

    # Hash integrity is checked before interpreting any content semantically.
    expected_context_keys = {"revision", "repository"}
    public_context = manifest.get("public_context")
    if not isinstance(public_context, dict) or set(public_context) - expected_context_keys:
        raise InputError("Evidence manifest public_context must contain only revision/repository strings")
    context = _safe_public_context(
        public_context.get("revision"), public_context.get("repository")
    )
    if context != public_context:
        raise InputError("Evidence manifest public_context must contain only explicit, nonempty values")
    if type(manifest.get("schema_version")) is not int or manifest["schema_version"] != 1:
        raise InputError("Unsupported evidence packet schema_version")
    if manifest.get("packet_type") != "datacenter-twin-lab-independent-reproduction":
        raise InputError("Unsupported evidence packet_type")
    if manifest.get("engine_version") != __version__:
        raise InputError(
            f"Packet engine version {manifest.get('engine_version')!r} does not match "
            f"the current engine {__version__!r}"
        )

    environment_path = directory / "environment.json"
    if environment_path.stat().st_size > MAX_ENVIRONMENT_BYTES:
        raise InputError("Environment metadata exceeds the supported size limit")
    try:
        environment = json.loads(
            environment_path.read_text(encoding="utf-8"), object_pairs_hook=_unique_json_object
        )
    except (OSError, json.JSONDecodeError) as exc:
        raise InputError(f"Cannot read environment metadata: {exc}") from exc
    expected_environment_keys = {
        "engine_version", "python_implementation", "python_version", "operating_system",
        "operating_system_release", "machine_architecture",
    }
    if (
        not isinstance(environment, dict)
        or set(environment) != expected_environment_keys
        or any(
            not isinstance(value, str)
            or not value.strip()
            or len(value) > 200
            or any(ord(char) < 32 for char in value)
            or "/" in value
            or "\\" in value
            or ":" in value
            for value in environment.values()
        )
        or environment.get("engine_version") != __version__
    ):
        raise InputError("Environment metadata has an unsupported or malformed shape")

    expected_files = _packet_artifacts(
        revision=context.get("revision"), repository=context.get("repository")
    )
    if set(expected_files) != expected_names:
        raise InputError("Evidence packet is missing or adds required numerical artifacts")
    expected_manifest = json.loads(expected_files[MANIFEST_NAME])
    if set(manifest) != set(expected_manifest):
        raise InputError("Evidence manifest fields do not match the supported packet schema")
    for key, expected_value in expected_manifest.items():
        if key == "artifacts":
            continue
        if manifest[key] != expected_value:
            raise InputError(f"Evidence manifest {key!r} does not match current reproduction")
    expected_artifacts = expected_manifest["artifacts"]
    if set(artifacts) != set(expected_artifacts):
        raise InputError("Evidence manifest does not list the exact supported artifact set")
    for name, expected_entry in expected_artifacts.items():
        actual_entry = artifacts[name]
        if name == "environment.json":
            if actual_entry.get("classification") != expected_entry["classification"]:
                raise InputError("Environment metadata has an invalid artifact classification")
            continue
        if actual_entry != expected_entry:
            raise InputError(f"Evidence manifest hash for {name} does not match current reproduction")
        expected_content = expected_files[name].encode("utf-8")
        artifact_path = directory / name
        if artifact_path.stat().st_size != len(expected_content) or artifact_path.read_bytes() != expected_content:
            raise InputError(f"Numerical artifact {name} differs from current-engine reproduction")

    return {
        "artifact_count": len(artifacts),
        "manifest_sha256": _sha256_file(manifest_path),
        "status": "integrity_and_reproduction_verified",
        "engine_version": __version__,
    }


def main(argv: list[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    if arguments and arguments[0] in ("build", "verify"):
        parser = argparse.ArgumentParser(
            description="Build or verify a synthetic continuity evidence packet"
        )
        commands = parser.add_subparsers(dest="command", required=True)
        build = commands.add_parser(
            "build", help="Build a new packet in a fresh destination directory"
        )
        build.add_argument("output", type=Path)
        build.add_argument("--revision", help="Explicit public commit or tag context")
        build.add_argument("--repository", help="Explicit public repository identifier or URL")
        verify = commands.add_parser(
            "verify", help="Check every packet artifact against manifest.json"
        )
        verify.add_argument("packet", type=Path)
        args = parser.parse_args(arguments)
    else:
        parser = argparse.ArgumentParser(
            description="Build or verify a synthetic continuity evidence packet"
        )
        mode = parser.add_mutually_exclusive_group(required=True)
        mode.add_argument("--output", type=Path, help="Create a packet in this fresh directory")
        mode.add_argument("--verify", type=Path, metavar="PATH", help="Verify an existing packet")
        parser.add_argument("--revision", help="Explicit public commit or tag context")
        parser.add_argument("--repository", help="Explicit public repository identifier or URL")
        args = parser.parse_args(arguments)
        args.command = "build" if args.output else "verify"
        if args.command == "verify":
            args.packet = args.verify
    try:
        if args.command == "build":
            result = build_packet(
                args.output, revision=getattr(args, "revision", None),
                repository=getattr(args, "repository", None),
            )
            print(f"Evidence packet: {result['destination']}")
            print(f"Artifacts checked by manifest: {result['artifact_count']}")
            print(f"Manifest SHA-256: {result['manifest_sha256']}")
        else:
            result = verify_packet(args.packet)
            print(
                "Verified file hashes and current-engine numerical reproduction "
                f"for {result['artifact_count']} artifacts ({result['engine_version']})"
            )
            print(f"Manifest SHA-256: {result['manifest_sha256']}")
    except (InputError, OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
