# Roadmap

Build from a reproducible outage calculation to experiments an engineer can adapt and teach.

## Available in the source and browser demo

| Capability | What you can do |
| --- | --- |
| Seven electrical presets | Compare the five 1 MW reference cases and two 50 MW AI-cluster outage cases. |
| Twelve interactive lessons | Change one input, predict the result, check a worked answer and export the calculation. |
| Fast browser calculation | Run locally with exact JavaScript arithmetic; request the Python cross-check when wanted. |
| Reports and sensitivity | Export JSON, Markdown and HTML; compare bounded reserve, efficiency, demand and delay sweeps. |
| Python and local dashboard | Reproduce calculations with the standard-library CLI, loopback API and React dashboard. The tagged 0.3.0a0 wheel preserves the earlier five-preset release; use a current source checkout for the AI presets. |
| Contribution material | Use the glossary, notebook, reproducibility capsule, issue forms and small contribution ideas. |

[Start the course](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy) or [inspect the 50 MW case](docs/scenarios/ai-cluster-50mw.md).

## Next capabilities — planned

1. **Bring your own scenario JSON into the browser.** Validate an imported file, identify the changed assumptions and export a reproducible result.
2. **Edit a demand timeline visually.** Use the existing demand-event contract to explore ramps represented as explicit steps, without hand-editing JSON.
3. **Export a lesson worksheet.** Bundle a learner's inputs, prediction, worked calculation and run hash in a printable exercise.

Prioritize these against reproducible first-run problems and learner feedback. They are planned work, not controls already available in the demo.

## Validation methodology

The core and API suites, frontend format/type/build checks, installed-wheel checks, local dashboard journeys, browser/Python journeys, and browser/native equality checks establish software behavior for synthetic fixtures. Numerical expectations use deterministic inputs, explicit units, independent hand calculations, stable input hashes, event logs, interval energy ledgers, and zero energy-balance residuals where the scenario contract requires it. Reference-case timing measures software execution on one local machine; it does not establish a performance benchmark, a scale target, or physical accuracy.

Independent external technical review has not yet been obtained. There is no formal security audit, shared deployment, facility calibration, FAT/SAT, live telemetry, validation dataset, calibrated alarm model, cooling model, workload-throughput model, or physical-control integration. The API remains loopback-only, the browser has no shared simulation backend or client analytics, and unknown costs and unavailable quantities remain explicit. See the [review protocol](docs/validation/review-protocol.md), [reproducibility capsule](docs/validation/reproducibility-capsule.md), and [synthetic provenance manifest](data/provenance/manifest.json).

## Next evidence to obtain

1. Independent checks of the [reproducibility capsule](docs/validation/reproducibility-capsule.md), with review scope, corrections, and unresolved limitations recorded publicly.
2. First-run feedback and scenario reuse by people outside the maintainer workflow; distinguish voluntary reports from automated test activity.
3. Educator and engineer feedback on the battery ride-through material and the 12-lesson course with reproducible lesson results.
4. Repeat use, release downloads, forks, Discussions, and contributions measured with explicit sources and denominators. Demo completion remains unknown without voluntary reports; no tracking pixels or client telemetry are installed.

## Later and deferred work

The released GitHub wheel supports [uvx](docs/quickstart.md#run-with-uv). Publishing on PyPI needs a configured owner publishing identity. Additional sweep parameters, optional public-data adapters, a stable extension API, and carefully bounded synthetic GPU/rack examples need separate contracts and provenance. 3D scenes, operational integrations, and a new fluent API do not take priority over reproducibility and first-run feedback.

A shared multi-user service, live facility telemetry, cooling/workload prediction, calibrated alarms, physical controls, and certification claims remain outside the current project scope. No star target is a validated schedule or evidence of model accuracy or adoption.

Original code and synthetic fixtures use [Apache-2.0](LICENSE); see [NOTICE](NOTICE) and the [browser runtime licenses](docs/third-party/README.md).
