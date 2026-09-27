"""Render the tutorial figure from verified reproduction outputs.

Optional authoring dependency: matplotlib 3.11.2. The engine, reproduction
script and downloaded inputs do not require it. Chart coordinates use floats
only for drawing; numerical verification uses the full exported decimal text.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def render(results: Path, output: Path, preview: Path | None, monochrome: bool) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch

    manifest = json.loads((results / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest["files"]:
        path = results / item["path"]
        if path.parent.resolve() != results.resolve():
            raise ValueError("Manifest file must be directly inside the results directory")
        if hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
            raise ValueError(f"Changed reproduction output: {item['path']}")
    for path in (output, preview):
        if path is not None and path.exists():
            raise FileExistsError(f"Choose a new figure path: {path}")

    ink, grid = "#202631", "#D9DEE7"
    demand = "#5A5A5A" if monochrome else "#2563A6"
    deficit = "#707070" if monochrome else "#A95310"
    deficit_fill = "#EEEEEE" if monochrome else "#FDEAD4"
    plt.rcParams.update({
        "font.family": "DejaVu Sans", "font.size": 13,
        "svg.fonttype": "none", "svg.hashsalt": "demand-timing-lesson",
        "text.color": ink, "axes.labelcolor": ink,
        "xtick.color": ink, "ytick.color": ink,
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.edgecolor": grid, "axes.linewidth": 1,
    })
    figure, axes = plt.subplots(3, 1, figsize=(8.4, 10.5), sharex=True, sharey=True)
    figure.subplots_adjust(left=0.115, right=0.96, top=0.77, bottom=0.19, hspace=0.65)
    figure.suptitle("Same energy. Different outage outcomes.", x=0.115, y=0.975,
                     ha="left", va="top", fontsize=19, fontweight="bold")
    figure.text(0.115, 0.925, "375 kWh requested in each 30-minute schedule\n"
                "100 kWh stored; charging disabled", ha="left", va="top", fontsize=13, linespacing=1.5)
    legend = [
        Line2D([0], [0], color=demand, linewidth=3, label="Requested power"),
        Line2D([0], [0], color=ink, linewidth=2, linestyle=(0, (4, 3)), label="Served power"),
        Patch(facecolor=deficit_fill, edgecolor=deficit, hatch="////", label="Unserved demand"),
    ]
    figure.legend(handles=legend, loc="upper left", bbox_to_anchor=(0.105, 0.85),
                  ncol=3, frameon=False, fontsize=11, columnspacing=1.3)
    labels = ["A · EARLY PEAK", "B · LATE PEAK", "C · SHIFTED PEAK"]
    for axis, case, label in zip(axes, manifest["cases"], labels, strict=True):
        result = json.loads((results / f"{case['case']}.json").read_text(encoding="utf-8"))
        intervals = result["intervals"]
        edges = [float(row["start_s"]) for row in intervals] + [float(intervals[-1]["end_s"])]
        requested = [float(row["requested_it_kw"]) for row in intervals]
        served = [float(row["served_it_kw"]) for row in intervals]
        axis.axvspan(300, 900, color="#EDF0F5", zorder=0)
        axis.fill_between(edges, served + served[-1:], requested + requested[-1:],
                          step="post", facecolor=deficit_fill, edgecolor=deficit,
                          hatch="////", linewidth=0.4, zorder=2)
        axis.stairs(requested, edges, baseline=None, color=demand, linewidth=3, zorder=3)
        axis.stairs(served, edges, baseline=None, color=ink, linewidth=1.8,
                    linestyle=(0, (4, 3)), zorder=4)
        axis.set_title(label, loc="left", fontsize=13, fontweight="bold", pad=14)
        unserved = float(result["summary"]["unserved_it_kwh"])
        value = "0" if unserved == 0 else f"{unserved:.4f}"
        axis.set_title(f"{value} kWh unserved", loc="right", fontsize=12, pad=14)
        axis.set_ylabel("IT power (kW)", fontsize=12)
        axis.set_yticks([0, 500, 1000], ["0", "500", "1,000"])
        axis.set_ylim(-30, 1150)
        axis.set_xlim(0, 1800)
        axis.set_axisbelow(True)
        axis.grid(axis="y", color=grid, linewidth=0.7)
        depletion = [event["at_s"] for event in result["events"] if event["action"] == "battery_depleted"]
        note = f"Depletion: {depletion[0]} s" if depletion else "No depletion\n2.5341 kWh remains"
        axis.text(0.64, 0.17, note, transform=axis.transAxes, fontsize=12,
                  bbox={"facecolor": "white", "edgecolor": "none", "pad": 3}, zorder=5)
    axes[-1].set_xticks([0, 300, 900, 1800], ["0", "300", "900", "1,800"])
    axes[-1].set_xlabel("Elapsed time (seconds)", labelpad=12, fontsize=13)
    figure.text(0.115, 0.085, "Grey band: utility and generator unavailable, 300–900 s.\n"
                "Original synthetic inputs · discharge efficiency 0.90 · distribution 0.95\n"
                "Rendered from complete Python outputs; displayed totals are rounded.",
                fontsize=10.5, linespacing=1.5, ha="left", va="top")
    output.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(output, format="svg", metadata={
        "Date": None, "Title": "Equal-energy demand schedules and outage outcomes",
        "Description": "Three synthetic 375 kWh schedules. Early peak: 81.1667 kWh unserved; "
                       "late peak: zero; shifted peak: 11.7222 kWh. See the tutorial for exact values.",
    })
    # Normalize generated XML for clean, reproducible Git diffs on Windows/Linux.
    svg = "\n".join(line.rstrip() for line in output.read_text(encoding="utf-8").splitlines())
    output.write_text(svg + "\n", encoding="utf-8", newline="\n")
    if preview is not None:
        preview.parent.mkdir(parents=True, exist_ok=True)
        figure.savefig(preview, dpi=150)
    plt.close(figure)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preview", type=Path)
    parser.add_argument("--monochrome", action="store_true", help="Render a grayscale readability check")
    args = parser.parse_args()
    render(args.results, args.output, args.preview, args.monochrome)


if __name__ == "__main__":
    main()
