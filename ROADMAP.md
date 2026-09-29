# Roadmap

## Current status: v1.0.0

Version **1.0.0** packages the current teaching-software workflow. It focuses on reproducible teaching experiments for datacenter power continuity. It does not claim production reliability analysis, site validation, or independent review. Review the supported release scope in [release readiness](docs/engineering/release-readiness.md).

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

Open the [guided experiment](https://khanlab.co.technology/), the [advanced workspace](https://khanlab.co.technology/?mode=advanced), the [50 MW outage case](https://khanlab.co.technology/?preset=ai_cluster_utility_loss), or the [12-lesson course](https://khanlab.co.technology/?lesson=power-energy). The [evidence hub](https://khanlab.co.technology/?mode=evidence) and [tutorial index](docs/tutorials/index.md) provide the supporting material.

Current source and the browser demo also [reopen scenario JSON and electrical run exports](docs/engineering/energy-scenario-workspace.md#reopen-a-saved-experiment): validate inputs, preview changed assumptions, calculate a fresh result and compare it with Python. The `1.0.0` release packages this workflow; earlier release assets remain unchanged.

All twelve lessons also [export a printable worksheet](docs/tutorials/power-systems-course.md#print-a-lesson-worksheet) with a submitted prediction, completed inputs, worked calculation, graph and reproducibility record. The standalone HTML keeps the prediction and answer on separate printed pages. The `1.0.0` release includes the same worksheet workflow as the current browser demo.

The advanced workspace also includes a [visual demand timeline](docs/engineering/energy-scenario-workspace.md#compose-a-demand-timeline): add, select, move and remove explicit load steps, preview requested energy, then run the schedule through the existing engine. Failures and recovery events are preserved. The `1.0.0` release packages the editor and the equal-energy timing tutorial; historical release assets remain unchanged.

## Next product decisions

Use reproducible first-run problems and learner feedback to prioritize the next capability. The guide, course, timeline editor and exports are available for evaluation; their delivery does not establish teaching effectiveness or independent use. The 1.0.0 release packages these workflows. Prioritize further changes using concrete reproduction or usability feedback.

## Release evidence and external review

The v1.0.0 software milestone covers the guide, course, eighteen presets, reports, scenario imports and visual demand editor. Release artifacts must pass the exact-source Python, browser, installed-package and hash checks described in [release readiness](docs/engineering/release-readiness.md). Historical candidate assets remain unchanged.

Independent external reproduction remains an open evidence goal. Use the existing [review discussion](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions/5) and [protocol](docs/validation/review-protocol.md), preserve reviewer attribution and scope, and resolve any reproduced mismatch. Maintainer or agent QA cannot satisfy that goal. Software versioning does not imply facility validation.

Calibrated facility examples are conditional on data rights, measurement provenance, uncertainty, a named validation owner, and an agreed acceptance boundary. None is included today. A DOI or archive citation is conditional on a stable artifact, approved deposit metadata, and an authorized archive account; no DOI or archive endorsement is available to cite now.

## Deferred boundaries

The existing isometric workspace and course scenes are teaching views of completed synthetic calculations. No broader 3D scene system or operational controller is promised. Live telemetry, shared multi-user service, cooling/workload prediction, calibrated alarms, protection studies, physical controls, and reliability or certification claims need separate contracts, evidence, security, and acceptance decisions; they are outside this release.

The loopback API remains local. There is no shared deployment, database, login, tenant isolation, persistent audit, facility telemetry, FAT/SAT, or real-time control. Do not use synthetic results as equipment selection, grid-adequacy, facility-safety, legal-compliance, uptime, or service-level evidence.

Outside adoption and repeat demo use remain unknown without voluntary, sourced reports. A 5,000-star aspiration has no validated timeline and is not evidence of accuracy, award readiness, or adoption. Maintainer delivery and CI do not count as outside review or endorsement.

Original code and synthetic fixtures use [Apache-2.0](LICENSE); see [NOTICE](NOTICE) and [browser runtime licenses](docs/third-party/README.md).
