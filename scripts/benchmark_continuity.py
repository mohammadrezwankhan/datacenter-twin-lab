"""Measure repeatable engine work, separately from browser and facility behavior."""

import argparse
from datetime import datetime, timezone
import json
from math import ceil
import platform
from statistics import median
import sys
from time import perf_counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from datacenter_twin import __version__
from datacenter_twin.continuity import simulate_continuity
from datacenter_twin.demo import PRESETS, demo_scenario


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=10)
    parser.add_argument("--preset", action="append", choices=tuple(PRESETS),
                        help="Repeat to select cases; defaults to all bundled presets")
    parser.add_argument("--revision", default=None, help="Explicit tested public source revision, if known")
    args = parser.parse_args()
    if not 1 <= args.runs <= 100:
        parser.error("--runs must be from 1 to 100")
    measurements = []
    for preset in dict.fromkeys(args.preset or PRESETS):
        scenario = demo_scenario(preset)
        simulate_continuity(scenario).to_dict()  # warm-up excluded
        times = []
        for _ in range(args.runs):
            start = perf_counter()
            result = simulate_continuity(scenario).to_dict()
            times.append((perf_counter()-start)*1000)
        measurements.append({
            "preset": preset, "input_sha256": result["input_sha256"],
            "assets": len(scenario.assets), "intervals": len(result["intervals"]),
            "runs": args.runs, "warmups_excluded": 1,
            "samples_ms": [round(value, 4) for value in times],
            "median_ms": round(median(times), 4),
            "p95_nearest_rank_ms": round(sorted(times)[ceil(0.95 * len(times)) - 1], 4),
            "max_ms": round(max(times), 4),
        })
    print(json.dumps({
        "schema_version": 1, "measured_at": datetime.now(timezone.utc).isoformat(),
        "engine_version": __version__, "revision": args.revision,
        "python": platform.python_version(), "os": platform.system(),
        "platform": platform.platform(), "architecture": platform.machine(),
        "processor": platform.processor() or None,
        "scope": "Engine plus to_dict; excludes import, HTTP, JSON encoding and browser rendering",
        "interpretation": "Observed execution in the stated environment; not a physical response rate, scale guarantee or cross-machine speed ranking.",
        "measurements": measurements,
    }, indent=2))


if __name__ == "__main__":
    main()
