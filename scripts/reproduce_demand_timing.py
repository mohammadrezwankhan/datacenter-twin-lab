"""Reproduce the equal-energy demand-timing tutorial with standard-library Python.

Run from a source checkout. A new output directory receives complete JSON,
Markdown and HTML results plus chart rows and a file manifest. The hand checks
use rational quantities; rounded display values are never used as inputs.
"""

from __future__ import annotations

import argparse
import csv
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from datacenter_twin.continuity import simulate_continuity  # noqa: E402
from datacenter_twin.reporting import render_html, render_markdown  # noqa: E402
from datacenter_twin.topology import SiteScenario  # noqa: E402


INPUTS = ROOT / "docs/examples/demand-timing"
CASES = ("early-peak", "late-peak", "shifted-peak")
TOLERANCE = Fraction(1, 10**90)

# All schedules contain 900 seconds at 1,000 kW and 900 seconds at 500 kW.
# The battery can deliver 100 * 0.90 * 0.95 = 85.5 kWh at the IT boundary.
EXPECTED = {
    "early-peak": {
        "outage_requested_kwh": Fraction(1000 * 600, 3600),
        "unserved_it_kwh": Fraction(487, 6),
        "unserved_duration_s": Fraction("292.2"),
        "battery_final_kwh": Fraction(0),
        "depletion_s": ["607.8"],
    },
    "late-peak": {
        "outage_requested_kwh": Fraction(500 * 600, 3600),
        "unserved_it_kwh": Fraction(0),
        "unserved_duration_s": Fraction(0),
        "battery_final_kwh": Fraction(1300, 513),
        "depletion_s": [],
    },
    "shifted-peak": {
        "outage_requested_kwh": Fraction(500 * 500 + 1000 * 100, 3600),
        "unserved_it_kwh": Fraction(211, 18),
        "unserved_duration_s": Fraction("42.2"),
        "battery_final_kwh": Fraction(0),
        "depletion_s": ["857.8"],
    },
}


def close(actual: str | Fraction, expected: Fraction, label: str) -> None:
    """Allow only the serialization rounding of the 100-digit engine output."""
    if abs(Fraction(actual) - expected) > TOLERANCE:
        raise ValueError(f"{label}: {actual} differs from {expected}")


def load_case(name: str) -> SiteScenario:
    return SiteScenario.from_dict(json.loads((INPUTS / f"{name}.json").read_text()))


def verify_case(name: str, result: dict) -> None:
    expected = EXPECTED[name]
    summary = result["summary"]
    close(summary["requested_it_kwh"], Fraction(375), f"{name}: total demand")
    for field in ("unserved_it_kwh", "unserved_duration_s", "battery_final_kwh"):
        close(summary[field], expected[field], f"{name}: {field}")
    close(
        summary["served_it_kwh"],
        Fraction(375) - expected["unserved_it_kwh"],
        f"{name}: served energy",
    )
    depletion = [event["at_s"] for event in result["events"] if event["action"] == "battery_depleted"]
    if depletion != expected["depletion_s"]:
        raise ValueError(f"{name}: unexpected depletion events {depletion}")

    # Integrate the returned power over its actual interval boundaries rather
    # than trusting a summary or residual field. Depletion can split a step.
    outage_energy = Fraction(0)
    requested = served = unserved = Fraction(0)
    for row in result["intervals"]:
        start, end = Fraction(row["start_s"]), Fraction(row["end_s"])
        hours = (end - start) / 3600
        requested += Fraction(row["requested_it_kw"]) * hours
        served += Fraction(row["served_it_kw"]) * hours
        unserved += Fraction(row["unserved_it_kw"]) * hours
        overlap = max(Fraction(0), min(end, Fraction(900)) - max(start, Fraction(300)))
        outage_energy += Fraction(row["requested_it_kw"]) * overlap / 3600
        close(row["battery_charge_kw"], Fraction(0), f"{name}: charging is disabled")
        close(row["generator_kw"], Fraction(0), f"{name}: no generator dispatch")
    close(requested, Fraction(375), f"{name}: integrated requested energy")
    close(served, Fraction(summary["served_it_kwh"]), f"{name}: integrated served energy")
    close(unserved, expected["unserved_it_kwh"], f"{name}: integrated unserved energy")
    close(outage_energy, expected["outage_requested_kwh"], f"{name}: outage demand")
    if summary["total_incremental_energy_charge"] is not None:
        raise ValueError(f"{name}: an unspecified tariff must remain unknown")


def write_results(target: Path) -> dict:
    # Refuse an existing directory: reruns must not replace a reader's records.
    target.mkdir(parents=True, exist_ok=False)
    cases = []
    rows = []
    for name in CASES:
        result = simulate_continuity(load_case(name)).to_dict()
        verify_case(name, result)
        outputs = {
            f"{name}.json": json.dumps(result, indent=2, ensure_ascii=True) + "\n",
            f"{name}.md": render_markdown(result),
            f"{name}.html": render_html(result),
        }
        for filename, text in outputs.items():
            (target / filename).write_text(text, encoding="utf-8", newline="\n")
        for row in result["intervals"]:
            rows.append({"case": name, **{field: row[field] for field in (
                "start_s", "end_s", "requested_it_kw", "served_it_kw", "unserved_it_kw"
            )}})
        cases.append({
            "case": name,
            "input_file": f"docs/examples/demand-timing/{name}.json",
            "input_file_sha256": hashlib.sha256((INPUTS / f"{name}.json").read_bytes()).hexdigest(),
            "input_sha256": result["input_sha256"],
            "run_id": result["run_id"],
            "engine_version": result["engine_version"],
            "summary": result["summary"],
            "hand_expectations": {
                field: str(value) if isinstance(value, Fraction) else value
                for field, value in EXPECTED[name].items()
            },
        })
    with (target / "chart-rows.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    manifest = {
        "schema_version": 1,
        "scope": "Original synthetic equal-energy timing lesson; software reproduction, not external review.",
        "cases": cases,
        "files": [
            {"path": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in sorted(target.iterdir()) if path.is_file()
        ],
    }
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="New directory for reproducible outputs")
    args = parser.parse_args()
    manifest = write_results(args.output)
    for case in manifest["cases"]:
        summary = case["summary"]
        print(f"{case['case']}: requested {summary['requested_it_kwh']} kWh; "
              f"unserved {summary['unserved_it_kwh']} kWh; input {case['input_sha256']}")


if __name__ == "__main__":
    main()
