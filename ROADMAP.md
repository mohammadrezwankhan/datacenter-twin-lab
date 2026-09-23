# Roadmap

## Current status: v0.4.0rc1 candidate

The current source is a **release candidate, not a stable release**. It focuses on reproducible teaching experiments for datacenter power continuity. It does not claim production reliability analysis, site validation, or independent review. Review candidate status and the release conditions in [release readiness](docs/engineering/release-readiness.md).

## Available in the current source and browser demo

| Capability                         | What is available                                                                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five-minute guided start           | Default first-visit route: predict, explicitly run, and explain a 1 MW / 100 kWh synthetic case. Compare the charging-disabled 50 kWh challenge.                                                           |
| Scenario catalog                   | Eighteen named cases, including five reference cases and facility-profile outage, demand-step, and extended-reserve cases for 50 MW, 200 MW, 30 MW, and 5 MW aggregate IT loads. All inputs are synthetic. |
| Advanced energy workspace          | Inspect an interactive isometric electrical scene, run and replay events, edit bounded assumptions, and export the completed result.                                                                       |
| Twelve browser lessons             | Four course chapters with predictions, challenge values, selectable scenes, event replay, worked answers, and result exports.                                                                              |
| Deterministic calculation          | Standard-library Python engine and exact JavaScript browser engine, with a Python comparison available on request. Full-result checks cover values, assumptions, and hashes.                               |
| Reports and sensitivity            | Export JSON, Markdown, and HTML; compare bounded reserve, efficiency, demand, and delay cases. Unknown values remain explicit.                                                                             |
| Evidence and contribution material | Reproducibility packet, independent-review protocol, source register, tutorials, notebook, scenario guidance, and contribution ideas.                                                                      |
| Local use                          | CLI and loopback dashboard. The browser demo runs its first result locally and has no shared simulation backend or client analytics.                                                                       |

Open the [guided experiment](https://mohammadrezwankhan.github.io/datacenter-twin-lab/), the [advanced workspace](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?mode=advanced), the [50 MW outage case](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?preset=ai_cluster_utility_loss), or the [12-lesson course](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy). The [evidence hub](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?mode=evidence) and [tutorial index](docs/tutorials/index.md) provide the supporting material.

## Planned capabilities

These are not controls in the current demo:

1. **Import a scenario JSON file in the browser.** Validate its schema, show which assumptions differ, and let a visitor export a reproducible result.
2. **Edit a demand timeline visually.** Compose explicit demand steps using the existing scenario contract; do not imply transient, workload, or GPU-job prediction.
3. **Export a lesson worksheet.** Provide a printable record of a learner's prediction, inputs, worked calculation, result, and hash.

Prioritize these against reproducible first-run problems and learner feedback. Do not describe planned work as implemented behavior.

## Evidence and stable-release conditions

Current automated checks target Python 3.12 and 3.14 on Windows and Linux. Chromium Playwright journeys run on Ubuntu with Python 3.12. Workflow configuration describes the per-commit matrix; inspect the exact commit's CI result before claiming it passed. Numerical and browser checks establish software behavior for synthetic fixtures only. The [benchmark method](docs/engineering/benchmark-method.md) explains environment-specific observations; timings are not a cross-system performance benchmark or equipment response measurement.

Before choosing a stable release:

1. Obtain an attributed, independent technical reconstruction through the [review protocol](docs/validation/review-protocol.md) and existing [review discussion](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions/5). Preserve the reviewer's scope and any corrections; do not substitute maintainer testing or automated agent output.
2. Resolve reproduced mismatches or publish their disposition and limitation.
3. Confirm the exact source, wheel, and browser asset hashes, commands, supported environments, and migration notes for the selected stable revision.
4. Publish a new stable tag and release only after the review and artifact checks are recorded. Keep `0.4.0rc1` and earlier alpha assets as historical versions.

Calibrated facility examples are conditional on data rights, measurement provenance, uncertainty, a named validation owner, and an agreed acceptance boundary. None is included today. A DOI or archive citation is conditional on a stable artifact, approved deposit metadata, and an authorized archive account; no DOI or archive endorsement is available to cite now.

## Deferred boundaries

The existing isometric workspace and course scenes are teaching views of completed synthetic calculations. No broader 3D scene system or operational controller is promised. Live telemetry, shared multi-user service, cooling/workload prediction, calibrated alarms, protection studies, physical controls, and reliability or certification claims need separate contracts, evidence, security, and acceptance decisions; they are outside this candidate.

The loopback API remains local. There is no shared deployment, database, login, tenant isolation, persistent audit, facility telemetry, FAT/SAT, or real-time control. Do not use synthetic results as equipment selection, grid-adequacy, facility-safety, legal-compliance, uptime, or service-level evidence.

Outside adoption and repeat demo use remain unknown without voluntary, sourced reports. A 5,000-star aspiration has no validated timeline and is not evidence of accuracy, award readiness, or adoption. Maintainer delivery and CI do not count as outside review or endorsement.

Original code and synthetic fixtures use [Apache-2.0](LICENSE); see [NOTICE](NOTICE) and [browser runtime licenses](docs/third-party/README.md).
