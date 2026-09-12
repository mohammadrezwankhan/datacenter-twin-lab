# Contributing

Datacenter Twin Lab helps datacenter engineers learn power continuity through deterministic, synthetic aggregate-load scenarios. Contributions should make a first run easier to follow, a result easier to inspect, or a bounded behavior easier to reproduce and review.

## Good first contributions

You can help without deriving a new electrical edge case:

- Fix unclear wording, a broken link, a misleading label, or a step that no longer matches the browser journey.
- Follow the [first-run quickstart](docs/quickstart.md), then report one confusing step with the page, control, expected wording, and observed wording.
- Check keyboard navigation, focus order, contrast, readable units, and event-table labels in the browser demo; record the browser and a reproducible observation.
- Make a small implementation change with a focused test and explain the user-visible result.
- Improve a scenario page, glossary entry, diagram, or first-run instruction without changing model semantics.
- Correct a dated primary-source citation while preserving the source date, identifier, and uncertainty.

Browse the [scenario catalog](docs/scenarios/index.md), [beginner contribution ideas](docs/scenarios/contribution-ideas.md), and [course notes](docs/tutorials/power-systems-course.md) before opening a feature proposal. Keep a proposed change to one bounded subsystem and explain the user outcome in the issue or pull request.

Numerical review is welcome when you can state the independent equation, units, and expected result. It is an optional deeper path for numerical bugs and new scenario behavior; a text, link, keyboard, or readability contribution can use the focused checks below.

## Before opening a pull request

Use Python 3.12 or later from the repository root:

```sh
python -m unittest discover -s tests -v
npm --prefix apps/web run build
```

For a documentation-only change, check relative links, code blocks, Mermaid fences, and caveat wording. Follow the first-run browser route when the copy describes a control. Do not include generated output files, private manuals, licensed standards text, credentials, customer traces, or internal planning/history.

For a numerical or scenario change, also run the affected preset and record the command, input hash, expected values, observed values, units, and whether the result is synthetic. A changed snapshot alone is not an independent derivation. Keep unknown costs and unavailable values explicit.

## Model and scope rules

The current model covers one synthetic aggregate IT load, topology, finite stored energy, generator delay/failure, conversion losses, path limits, shared-domain events, and deterministic replay. The browser AI-cluster teaching case scales the synthetic demand to 50,000 kW and initial battery energy to 5,000 kWh while preserving the fixture ratios. It does not establish facility calibration, protection coordination, AC transients, cooling behavior, workload throughput, certification, uptime, grid adequacy, GPU performance, or physical safety. Do not add physical-control instructions or imply that a test is an equipment validation.

New calculations need explicit units, deterministic behavior or a documented source of nondeterminism, provenance for third-party data, and at least one independently stated expected result. Keep schema-1 planning/PUE inputs separate from schema-2 electrical topology; neither model may silently infer the other.

## Pull requests

Use the pull-request template. Describe the user-visible result, files changed, checks run, assumptions, and any open limitation. Small focused changes are easier to verify. Preserve third-party notices and Apache-2.0 licensing terms.

For confidential security concerns, follow [SECURITY.md](SECURITY.md). Do not put credentials, private source material, or customer data in a public issue or pull request. For normal questions and reproducibility help, use [GitHub Discussions](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions) or open a focused issue.

## Assumptions and limits

The synthetic 1 MW fixture uses 1,000 kW IT demand, 1,800 s duration, 0.95 distribution efficiency, 100 kWh initial and maximum battery energy, 0.90 discharge efficiency, 700 kW path capacities, a 30 s generator start delay, and a fictional USD 0.10/kWh tariff. The 50 MW AI-cluster teaching case uses 50,000 kW and 5,000 kWh with the same ratios. These values are assumptions, not selected equipment ratings, live prices, a benchmark, a certification, legal-compliance evidence, or a real-site calibration.

The model excludes cooling transients, workload queues and throughput, battery aging, temperature, generator ramp/cooldown/fuel dynamics, transfer and switching transients, AC load flow, impedance-based load sharing, protection coordination, harmonics, short-circuit and arc-flash studies, reliability probabilities, Tier claims, service-level claims, physical controls, and facility safety assessment. Unknown costs, unavailable quantities, and missing data must remain explicit.

The browser demo has no shared simulation backend or client analytics. The API binds to loopback. No shared service, database, login, tenant isolation, persistent audit, facility telemetry, FAT/SAT, independent external review, formal security audit, or calibration dataset is supplied by this release. The browser's exact JavaScript default and optional on-demand Python verification are software behaviors to be checked by the current release evidence; neither establishes physical accuracy. Review the [reproducibility capsule](docs/validation/reproducibility-capsule.md) and [review protocol](docs/validation/review-protocol.md) before making a numerical claim.

The public source tree excludes private manuals, planning references and the private repository history. Original code and synthetic fixtures use [Apache-2.0](LICENSE); preserve [NOTICE](NOTICE) and the [browser runtime licenses](docs/third-party/README.md).
