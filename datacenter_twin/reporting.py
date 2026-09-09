"""Dependency-free deterministic Markdown and HTML continuity reports."""

from collections import Counter
from html import escape
from typing import Any

from .contracts import InputError


def _require_result(result: dict) -> dict:
    if not isinstance(result, dict):
        raise InputError("Report result must be an object")
    if not isinstance(result.get("scenario", result.get("base_scenario")), dict):
        raise InputError("Report result must include a scenario")
    if "summary" not in result and not ("runs" in result and "parameter" in result):
        raise InputError("Report result must be a continuity run or sensitivity sweep")
    return result


def _md(value: Any) -> str:
    """Escape dynamic text for a Markdown table or paragraph."""

    text = "" if value is None else str(value)
    text = text.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    for char in ("\\", "|", "`", "*", "_", "[", "]", "(", ")", "#", "!", ">", "+", "-", "~"):
        text = text.replace(char, "\\" + char)
    return text


def _scenario(result: dict) -> dict:
    return result.get("scenario") or result.get("base_scenario") or {}


def _scenario_rows(scenario: dict) -> list[tuple[str, str, str]]:
    units = {
        "duration_s": "s", "step_s": "s", "it_demand_kw": "kW", "it_capacity_kw": "kW",
        "distribution_efficiency": "ratio", "generator_start_delay_s": "s",
        "battery_capacity_kwh": "kWh", "battery_initial_kwh": "kWh", "battery_charge_kw": "kW",
        "battery_charge_efficiency": "ratio", "battery_discharge_efficiency": "ratio",
        "tariff_per_kwh": "currency/kWh", "generator_cost_per_kwh": "currency/kWh",
    }
    keys = ("id", "name", "currency", "duration_s", "step_s", "it_demand_kw", "it_capacity_kw",
            "distribution_efficiency", "generator_start_delay_s", "battery_capacity_kwh",
            "battery_initial_kwh", "battery_charge_kw", "battery_charge_efficiency",
            "battery_discharge_efficiency", "tariff_per_kwh", "generator_cost_per_kwh")
    return [(key, str(scenario.get(key, "unknown")), units.get(key, "")) for key in keys]


def _warnings(run: dict) -> Counter:
    counts: Counter = Counter()
    for interval in run.get("intervals", []):
        for warning in interval.get("warnings", []):
            counts[str(warning)] += 1
    return counts


def _single_summary(result: dict) -> dict:
    summary = dict(result.get("summary", {}))
    summary.setdefault("requested_kwh", summary.get("requested_it_kwh", "unknown"))
    summary.setdefault("served_kwh", summary.get("served_it_kwh", "unknown"))
    summary.setdefault("unserved_kwh", summary.get("unserved_it_kwh", "unknown"))
    summary.setdefault("unserved_seconds", summary.get("unserved_duration_s", "unknown"))
    summary.setdefault("first_battery_depletion_s", next(
        (event.get("at_s") for event in result.get("events", []) if event.get("action") == "battery_depleted"), None))
    summary.setdefault("cost_unknowns", [key for key in ("generator_energy_charge", "total_incremental_energy_charge")
                                          if summary.get(key) is None])
    return summary


def _summary_rows(summary: dict) -> list[tuple[str, str, str]]:
    depletion = summary.get("first_battery_depletion_s")
    return [
        ("Requested IT energy", summary.get("requested_kwh", "unknown"), "kWh"),
        ("Served IT energy", summary.get("served_kwh", "unknown"), "kWh"),
        ("Unserved IT energy", summary.get("unserved_kwh", "unknown"), "kWh"),
        ("Unserved duration", summary.get("unserved_seconds", "unknown"), "s"),
        ("First battery depletion", "none" if depletion is None else depletion, "s"),
        ("Battery final energy", summary.get("battery_final_kwh", "unknown"), "kWh"),
        ("Peak unserved demand", summary.get("peak_unserved_kw", "unknown"), "kW"),
        ("Service status", summary.get("service_status", "unknown"), ""),
        ("Cost status", summary.get("cost_status", "unknown"), ""),
        ("Cost unknowns", ", ".join(summary.get("cost_unknowns", [])) or "none", ""),
        ("Energy balance residual", summary.get("energy_balance_residual_kwh", "unknown"), "kWh"),
    ]


def _markdown_table(headers: tuple[str, ...], rows: list[tuple[Any, ...]]) -> list[str]:
    # Headers are fixed report labels; only caller data needs escaping.
    lines = ["| " + " | ".join(str(h) for h in headers) + " |",
             "| " + " | ".join("---" for _ in headers) + " |"]
    lines.extend("| " + " | ".join(_md(value) for value in row) + " |" for row in rows)
    return lines


def _sweep_rows(result: dict) -> tuple[list[tuple[str, ...]], list[str]]:
    rows = []
    warnings: Counter = Counter()
    for entry in result.get("runs", []):
        summary = entry.get("summary", {})
        rows.append((
            entry.get("value_label", entry.get("value", "unknown")),
            summary.get("requested_kwh", summary.get("requested_it_kwh", "unknown")),
            summary.get("served_kwh", summary.get("served_it_kwh", "unknown")),
            summary.get("unserved_kwh", summary.get("unserved_it_kwh", "unknown")),
            summary.get("unserved_seconds", summary.get("unserved_duration_s", "unknown")),
            "none" if summary.get("first_battery_depletion_s") is None else summary.get("first_battery_depletion_s"),
            summary.get("service_status", "unknown"),
            ", ".join(summary.get("cost_unknowns", [])) or "none",
            entry.get("run_id", "unknown"),
            entry.get("input_sha256", "unknown"),
        ))
        detail = entry.get("result")
        if detail:
            warnings.update(_warnings(detail))
        else:
            warnings.update({str(name): int(count) for name, count in summary.get("warning_counts", {}).items()})
    return rows, [f"{name}: {count} interval(s)" for name, count in sorted(warnings.items())]


def _event_rows(result: dict) -> list[tuple[Any, ...]]:
    return [
        (event.get("at_s", "unknown"), event.get("action", "unknown"),
         event.get("target", "unknown"), event.get("origin", "scenario"),
         event.get("ready_at_s", ""))
        for event in result.get("events", [])
    ]


def render_markdown(result: dict) -> str:
    """Render a continuity run or sweep as byte-reproducible Markdown."""

    result = _require_result(result)
    is_sweep = "runs" in result and "parameter" in result
    scenario = _scenario(result)
    lines = ["# Datacenter Twin Lab continuity report", "", f"Model: {_md(result.get('model', 'unknown'))}",
             f"Engine version: {_md(result.get('engine_version', 'unknown'))}"]
    if is_sweep:
        lines.extend([
            f"Base input SHA-256: {_md(result.get('base_input_sha256', 'unknown'))}",
            f"Parameter: {_md(result.get('parameter', 'unknown'))} ({_md(result.get('parameter_unit', ''))})",
            "", "## Sensitivity outcomes", "",
        ])
        rows, warning_lines = _sweep_rows(result)
        lines.extend(_markdown_table(("Value", "Requested (kWh)", "Served (kWh)", "Unserved (kWh)",
                                      "Unserved (s)", "Battery depletion (s)", "Service", "Cost unknowns",
                                      "Run ID", "Input SHA-256"), rows))
    else:
        lines.extend([f"Run ID: {_md(result.get('run_id', 'unknown'))}",
                      f"Input SHA-256: {_md(result.get('input_sha256', 'unknown'))}",
                      "", "## Outcome", ""])
        lines.extend(_markdown_table(("Measure", "Value", "Unit"), _summary_rows(_single_summary(result))))
        lines.extend(["", "## Event timeline", ""])
        lines.extend(_markdown_table(("At (s)", "Action", "Target", "Origin", "Ready at (s)"), _event_rows(result))
                      if _event_rows(result) else ["No events were emitted."])
        warning_counts = _warnings(result)
        warning_lines = [f"{name}: {count} interval(s)" for name, count in sorted(warning_counts.items())]
    lines.extend(["", "## Scenario assumptions", ""])
    lines.extend(_markdown_table(("Field", "Value", "Unit"), _scenario_rows(scenario)))
    lines.extend(["", "## Warning summary", ""])
    lines.extend(_markdown_table(("Warning", "Count"), [tuple(item.rsplit(": ", 1)) for item in warning_lines])
                  if warning_lines else ["No interval warnings were emitted."])
    if is_sweep:
        lines.extend(["", f"Full per-run results included: {_md(result.get('full_results_included', False))}"])
    lines.extend(["", "## Assumptions", ""])
    lines.extend(f"- {_md(item)}" for item in result.get("assumptions", []))
    lines.extend(["", "## Limitations", ""])
    lines.extend(f"- {_md(item)}" for item in result.get("limitations", []))
    return "\n".join(lines) + "\n"


def _html_table(headers: tuple[str, ...], rows: list[tuple[Any, ...]]) -> str:
    head = "".join(f"<th>{escape(str(value), quote=True)}</th>" for value in headers)
    body = "".join("<tr>" + "".join(f"<td>{escape(str(value), quote=True)}</td>" for value in row) + "</tr>" for row in rows)
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def render_html(result: dict) -> str:
    """Render a continuity run or sweep as self-contained deterministic HTML."""

    result = _require_result(result)
    is_sweep = "runs" in result and "parameter" in result
    scenario = _scenario(result)
    title = "Datacenter Twin Lab continuity report"
    parts = ["<!doctype html>", '<html lang="en">', "<head><meta charset=\"utf-8\"><title>"
             + escape(title, quote=True) + "</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse;margin:1rem 0;width:100%}th,td{border:1px solid #ccc;padding:.35rem;text-align:left}th{background:#f2f2f2}code{word-break:break-all}</style></head><body>",
             f"<h1>{escape(title)}</h1>",
             f"<p>Model: <code>{escape(str(result.get('model', 'unknown')), quote=True)}</code><br>Engine version: <code>{escape(str(result.get('engine_version', 'unknown')), quote=True)}</code></p>"]
    if is_sweep:
        parts.append(f"<p>Base input SHA-256: <code>{escape(str(result.get('base_input_sha256', 'unknown')), quote=True)}</code><br>Parameter: <code>{escape(str(result.get('parameter', 'unknown')), quote=True)}</code> ({escape(str(result.get('parameter_unit', '')), quote=True)})</p>")
        rows, warning_lines = _sweep_rows(result)
        parts.extend(["<h2>Sensitivity outcomes</h2>", _html_table(("Value", "Requested (kWh)", "Served (kWh)", "Unserved (kWh)", "Unserved (s)", "Battery depletion (s)", "Service", "Cost unknowns", "Run ID", "Input SHA-256"), rows)])
    else:
        parts.append(f"<p>Run ID: <code>{escape(str(result.get('run_id', 'unknown')), quote=True)}</code><br>Input SHA-256: <code>{escape(str(result.get('input_sha256', 'unknown')), quote=True)}</code></p>")
        warning_counts = _warnings(result)
        warning_lines = [f"{name}: {count} interval(s)" for name, count in sorted(warning_counts.items())]
        parts.extend(["<h2>Outcome</h2>", _html_table(("Measure", "Value", "Unit"), _summary_rows(_single_summary(result))), "<h2>Event timeline</h2>"])
        event_rows = _event_rows(result)
        parts.append(_html_table(("At (s)", "Action", "Target", "Origin", "Ready at (s)"), event_rows)
                     if event_rows else "<p>No events were emitted.</p>")
    parts.extend(["<h2>Scenario assumptions</h2>", _html_table(("Field", "Value", "Unit"), _scenario_rows(scenario)), "<h2>Warning summary</h2>"])
    parts.append(_html_table(("Warning", "Count"), [tuple(item.rsplit(": ", 1)) for item in warning_lines]) if warning_lines else "<p>No interval warnings were emitted.</p>")
    if is_sweep:
        parts.append(f"<p>Full per-run results included: {escape(str(result.get('full_results_included', False)), quote=True)}</p>")
    for heading, key in (("Assumptions", "assumptions"), ("Limitations", "limitations")):
        items = "".join(f"<li>{escape(str(item), quote=True)}</li>" for item in result.get(key, []))
        parts.extend([f"<h2>{heading}</h2>", f"<ul>{items}</ul>"])
    parts.extend(["</body>", "</html>"])
    return "\n".join(parts) + "\n"
