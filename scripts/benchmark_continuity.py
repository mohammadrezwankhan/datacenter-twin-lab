"""Measure the five synthetic reference cases; this is not a real-site scale claim."""

import argparse
import json
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
    args = parser.parse_args()
    if not 1 <= args.runs <= 100:
        parser.error("--runs must be from 1 to 100")
    measurements = []
    for preset in PRESETS:
        scenario = demo_scenario(preset)
        simulate_continuity(scenario).to_dict()  # warm-up excluded
        times = []
        for _ in range(args.runs):
            start = perf_counter()
            result = simulate_continuity(scenario).to_dict()
            times.append((perf_counter()-start)*1000)
        measurements.append({"preset":preset,"assets":len(scenario.assets),"intervals":len(result["intervals"]),
                             "runs":args.runs,"median_ms":round(median(times),2),"max_ms":round(max(times),2)})
    print(json.dumps({"engine_version":__version__,"python":platform.python_version(),"os":platform.system(),
                      "scope":"Engine plus to_dict; excludes HTTP, JSON encoding and browser rendering",
                      "measurements":measurements},indent=2))


if __name__ == "__main__":
    main()
