# Tutorials

Datacenter engineers can start with a short, reproducible continuity experiment: predict battery ride-through for a synthetic **1 MW** IT load, run it, and explain the energy ledger. The browser defaults to **100 kWh** stored energy; the **50 kWh** challenge changes only the opening reserve.

The exact lesson uses charging disabled, a failed generator, a utility outage at `300 s`, recovery at `900 s`, `0.90` battery-discharge efficiency, and `0.95` distribution efficiency. For 100 kWh, `100 × 0.90 × 0.95 = 85.5 kWh` reaches IT, giving **307.8 s from the outage** and depletion at **607.8 s elapsed**. For 50 kWh, **42.75 kWh** reaches IT, giving **153.9 s from outage** and depletion at **453.9 s elapsed**. These are different quantities, not rounding variants.

[Open the guided experiment](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) · [Read the canonical case and equations](../canonical-case.md) · [Open the evidence hub](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?mode=evidence)

## Choose a reproducible question

| Case                        | Question                                                           | Expected result                                                           | Route or explanation                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guided 1 MW experiment      | How long does 100 kWh support 1 MW during this outage?             | 307.8 s ride-through; depletion at 607.8 s elapsed                        | [Browser guide](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) · [Canonical case](../canonical-case.md)                                             |
| 50 kWh challenge            | Does halving stored energy halve ride-through?                     | 153.9 s after outage; depletion at 453.9 s elapsed with charging disabled | Select 50 kWh in the [guided browser experiment](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) · [Independent reproduction packet](../evidence.md) |
| CLI starting fixture        | What does the original 1 MW `generator_failure` preset produce?    | Battery depletion at 607.8 s elapsed; utility recovers at 900 s           | [Quickstart](../quickstart.md) · [generator_failure](../scenarios/generator_failure.md)                                                                         |
| 50 MW aggregate outage      | Does scaling IT demand and stored energy by 50 preserve the ratio? | 307.8 s ride-through; depletion at 607.8 s elapsed                        | [Browser preset](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?preset=ai_cluster_utility_loss) · [Scenario note](../scenarios/ai-cluster-50mw.md)   |
| Surviving distribution path | Can one 700 kW gross path carry a 1 MW IT request?                 | 665 kW served; 335 kW unserved during the 600 s maintenance interval      | [Continuity walkthrough](continuity-walkthrough.md) · [path_maintenance](../scenarios/path_maintenance.md)                                                      |
| Twelve-lesson course        | How do power, energy, event timing, and topology relate?           | Twelve bounded exercises with predictions and reproducible results        | [Start at power and energy](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy) · [Course notes](power-systems-course.md)            |
| Battery worksheet           | What changes when the available stored energy is halved?           | Compare the charging-disabled 100 and 50 kWh lesson cases                 | [Prediction and separate worked answer](battery-ride-through-worksheet.md)                                                                                      |

The guided route has three actions. **01 · Predict:** enter an estimate in seconds measured from the outage at `300 s`. **02 · Run:** explicitly request the calculation; no result appears beforehand. **03 · Explain:** compare ride-through with elapsed depletion, inspect requested/served/unserved outage energy, export the complete JSON result, or request optional Python verification. The current v0.4.0rc1 source is a **release candidate**, not a stable release; [independent external technical review has not been obtained](../engineering/release-readiness.md).

## Browser and local workflows

- [Open the advanced energy workspace](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?mode=advanced) to inspect the full electrical topology, replay events, change bounded assumptions, and export a run.
- [Open the evidence hub's captioned 60-second demo](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?mode=evidence#demo) or read its [transcript and reproduction notes](../examples/proof-demo.md).
- Follow the [quickstart](../quickstart.md) for the local CLI/dashboard, historical pinned v0.3.0a0 wheel, source build, and verification commands.
- Use the [course studio guide](../engineering/course-studio.md) to navigate the four-chapter course and its interactive scenes.
- Use the [evidence packet](../evidence.md) and [benchmark method](../engineering/benchmark-method.md) to reproduce the candidate's numerical artifacts and interpret timing observations.
- Start a small contribution with [adding a scenario](../engineering/adding-a-scenario.md).

The browser's default result uses exact JavaScript arithmetic locally. **Verify against Python** is optional and loads the Python runtime only when selected. The [browser guide](../engineering/browser-demo.md) describes privacy, runtime, and local observation boundaries. Current source has 18 named scenarios and four illustrative facility profiles; earlier alpha assets retain their published contents.

Use the [unit-aware glossary](../scenarios/glossary.md) to distinguish power in kW from accumulated energy in kWh. Browse the [scenario catalog](../scenarios/index.md) for other failure and recovery cases, and see [contribution ideas](../scenarios/contribution-ideas.md) for a bounded first contribution.

## Assumptions and limits

The 50 MW case is a synthetic 50× scale-up of the verified 1 MW / 100 kWh fixture. The current model covers one aggregate IT load, explicit topology, finite stored energy, conversion losses, path limits, shared-domain events, event boundaries, deterministic replay, and exact energy accounting. It does not establish GPU throughput, grid adequacy, equipment selection, facility calibration, cooling, workload queues, battery aging, generator ramp/cooldown/fuel dynamics, transfer and switching transients, AC load flow, impedance-based sharing, protection coordination, harmonics, short-circuit or arc-flash studies, reliability probabilities, Tier claims, service-level claims, certification, physical controls, or physical safety.

The 1 MW reference fixture uses 1,000 kW IT demand, 1,800 s duration, 0.95 distribution efficiency, 100 kWh initial and maximum battery energy, 0.90 discharge efficiency, a 30 s generator start delay, 700 kW path capacities, and a fictional USD 0.10/kWh tariff. The 50 MW case scales demand and battery energy to 50,000 kW and 5,000 kWh with the same ratios. All ratings, demand, efficiencies, event times, and tariff values are synthetic assumptions; they are not selected-equipment ratings, live prices, a benchmark, a certification, legal-compliance evidence, or real-site calibration. Unknown costs and unavailable quantities stay explicit.

The original CLI `generator_failure` preset allows charging. With a 50 kWh initial balance, its pre-outage charge yields depletion at 478.2675 s elapsed; the guided course lesson disables charging and yields 453.9 s. Compare like-for-like assumptions using the [canonical case](../canonical-case.md).

Schema-1 PUE and energy planning is separate from schema-2 electrical topology. The dated NVIDIA/model/AWS/Azure/OCI identifiers and one dated Azure East US retail meter are source-backed assumptions, not live feeds, account quotes, capacity allocations, or performance equivalence. Germany, Virginia, and India links are screening pointers, not complete jurisdiction packs or legal advice.

These examples demonstrate software behavior for synthetic fixtures and do not establish facility reliability or physical validation. The browser has no shared simulation backend or client analytics; the API binds to loopback. Independent external review, formal security audit, shared deployment, facility measurements, and validation data remain absent. No facility calibration, cooling/workload prediction, or live controls are claimed. Automated checks and maintainer-produced evidence are not an independent review.

Original code and synthetic fixtures use [Apache-2.0](../../LICENSE). See [NOTICE](../../NOTICE), [synthetic provenance](../../data/provenance/manifest.json), and [browser runtime licenses](../third-party/README.md).
