"""Reproduce the synthetic battery power/energy lesson using the standard library.

Each case is checked against hand-derived quantities and its complete power
timeline before any output is written. Use a new output directory for each run.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from datacenter_twin.continuity import simulate_continuity  # noqa: E402
from datacenter_twin.reporting import render_html, render_markdown  # noqa: E402
from datacenter_twin.topology import SiteScenario  # noqa: E402

INPUTS = ROOT / "docs/examples/battery-limits"
TOLERANCE = Fraction(1, 10**90)


@dataclass(frozen=True)
class Expectation:
    initial_kwh: int
    served_kw: int
    unserved_kwh: Fraction
    shortfall_s: Fraction
    final_kwh: Fraction
    depletion_s: str | None


# Hand calculations are derived in docs/tutorials/battery-power-and-energy.md.
# The 600 kW battery output rating delivers 600 * 0.95 = 570 kW to IT.
EXPECTED = {
    "100kwh-600kw": Expectation(100, 570, Fraction(487, 6), Fraction(600), Fraction(0), "840"),
    "100kwh-1200kw": Expectation(
        100, 1000, Fraction(487, 6), Fraction("292.2"), Fraction(0), "607.8"
    ),
    "200kwh-600kw": Expectation(200, 570, Fraction(215, 3), Fraction(600), Fraction(800, 9), None),
    "200kwh-1200kw": Expectation(200, 1000, Fraction(0), Fraction(0), Fraction(2600, 513), None),
}
CASES = tuple(EXPECTED)


def close(actual: str | Fraction, expected: Fraction, label: str) -> None:
    """Allow serialization rounding of the engine's 100-digit decimal arithmetic."""
    if abs(Fraction(actual) - expected) > TOLERANCE:
        raise ValueError(f"{label}: {actual} differs from {expected}")


def load_case(name: str) -> SiteScenario:
    if name not in EXPECTED:
        raise ValueError(f"Unknown battery lesson case: {name}")
    return SiteScenario.from_dict(json.loads((INPUTS / f"{name}.json").read_text(encoding="utf-8")))


def verify_case(name: str, result: dict[str, Any]) -> None:
    expected = EXPECTED[name]
    summary = result["summary"]
    close(summary["requested_it_kwh"], Fraction(500), f"{name}: requested energy")
    close(summary["served_it_kwh"], 500 - expected.unserved_kwh, f"{name}: served energy")
    close(summary["unserved_it_kwh"], expected.unserved_kwh, f"{name}: unserved energy")
    close(summary["unserved_duration_s"], expected.shortfall_s, f"{name}: shortfall duration")
    close(summary["battery_final_kwh"], expected.final_kwh, f"{name}: final stored energy")
    if summary["total_incremental_energy_charge"] is not None:
        raise ValueError(f"{name}: unspecified prices must remain unknown")
    depletion = [e["at_s"] for e in result["events"] if e["action"] == "battery_depleted"]
    if depletion != ([] if expected.depletion_s is None else [expected.depletion_s]):
        raise ValueError(f"{name}: unexpected depletion events {depletion}")

    # Reconstruct energy and shortfall duration from actual interval boundaries.
    # A zero internal residual alone cannot prove the lesson's expected behavior.
    cursor = served = unserved = shortfall = Fraction(0)
    stored = Fraction(expected.initial_kwh)
    depleted_at = None if expected.depletion_s is None else Fraction(expected.depletion_s)
    boundaries = [Fraction(300), Fraction(900)]
    if depleted_at is not None:
        boundaries.append(depleted_at)
    for row in result["intervals"]:
        start, end = Fraction(row["start_s"]), Fraction(row["end_s"])
        if start != cursor or end <= start or any(start < point < end for point in boundaries):
            raise ValueError(f"{name}: missing, overlapping or unsplit interval")
        seconds = end - start
        hours = seconds / 3600
        outage = 300 <= start < 900
        expected_power = Fraction(expected.served_kw if outage else 1000)
        if outage and depleted_at is not None and start >= depleted_at:
            expected_power = Fraction(0)
        close(row["duration_s"], seconds, f"{name}: interval duration")
        close(row["requested_it_kw"], Fraction(1000), f"{name}: requested power")
        close(row["served_it_kw"], expected_power, f"{name}: served power")
        close(row["unserved_it_kw"], 1000 - expected_power, f"{name}: unserved power")
        close(row["battery_charge_kw"], Fraction(0), f"{name}: charging disabled")
        close(row["generator_kw"], Fraction(0), f"{name}: generator supplies no energy")
        battery_kw = expected_power / Fraction("0.95") if outage else Fraction(0)
        close(row["battery_discharge_kw"], battery_kw, f"{name}: battery output power")
        if outage:
            close(row["grid_kw"], Fraction(0), f"{name}: utility unavailable")
        close(row["battery_start_kwh"], stored, f"{name}: opening stored energy")
        stored -= battery_kw * hours / Fraction("0.90")
        close(row["battery_end_kwh"], stored, f"{name}: closing stored energy")
        served += Fraction(row["served_it_kw"]) * hours
        unserved += Fraction(row["unserved_it_kw"]) * hours
        if Fraction(row["unserved_it_kw"]) > 0:
            shortfall += seconds
        cursor = end
    close(cursor, Fraction(1800), f"{name}: complete timeline")
    close(served, 500 - expected.unserved_kwh, f"{name}: integrated served energy")
    close(unserved, expected.unserved_kwh, f"{name}: integrated unserved energy")
    close(shortfall, expected.shortfall_s, f"{name}: integrated shortfall duration")
    close(stored, expected.final_kwh, f"{name}: reconstructed final reserve")


def write_results(target: Path) -> dict[str, Any]:
    results = {name: simulate_continuity(load_case(name)).to_dict() for name in CASES}
    for name, result in results.items():
        verify_case(name, result)
    # Validate all cases first; never overwrite a reader's existing records.
    target.mkdir(parents=True, exist_ok=False)
    cases = []
    for name, result in results.items():
        outputs = {
            f"{name}.json": json.dumps(result, indent=2, ensure_ascii=True) + "\n",
            f"{name}.md": render_markdown(result),
            f"{name}.html": render_html(result),
        }
        for filename, content in outputs.items():
            (target / filename).write_text(content, encoding="utf-8", newline="\n")
        cases.append(
            {
                "case": name,
                "input_file": f"docs/examples/battery-limits/{name}.json",
                "input_file_sha256": hashlib.sha256(
                    (INPUTS / f"{name}.json").read_bytes()
                ).hexdigest(),
                "input_sha256": result["input_sha256"],
                "run_id": result["run_id"],
                "engine_version": result["engine_version"],
                "summary": result["summary"],
            }
        )
    manifest = {
        "schema_version": 1,
        "scope": (
            "Original synthetic battery power/energy lesson; maintainer software reproduction."
        ),
        "cases": cases,
        "files": [
            {"path": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in sorted(target.iterdir())
        ],
    }
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, required=True, help="New directory for checked outputs"
    )
    args = parser.parse_args()
    try:
        manifest = write_results(args.output)
    except FileExistsError:
        parser.error("Output already exists; choose a new directory to preserve earlier results")
    for case in manifest["cases"]:
        summary = case["summary"]
        sys.stdout.write(
            f"{case['case']}: unserved {summary['unserved_it_kwh']} kWh; "
            f"any-shortfall duration {summary['unserved_duration_s']} s\n"
        )


if __name__ == "__main__":
    main()
