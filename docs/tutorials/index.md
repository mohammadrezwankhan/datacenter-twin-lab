# Tutorials

**Question:** what does a finite battery buy an aggregate AI-cluster load when utility and generator supply fail?

The browser teaching case uses **50,000 kW (50 MW)** of synthetic IT demand and **5,000 kWh (5 MWh)** of initial battery energy. At the modeled 0.90 discharge and 0.95 distribution efficiencies, it supplies IT for **307.8 s** and reaches battery depletion at **607.8 s**. Start with that result, then use the smaller reference cases to inspect each part of the calculation.

| Runnable case | Question | Expected result | Where to run it |
| --- | --- | --- | --- |
| AI-cluster outage | How long does a 5 MWh reserve support a 50 MW aggregate load? | 307.8 s ride-through; depletion at 607.8 s; utility restoration at 900 s | [Browser demo](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) · [AI-cluster scenario note](../scenarios/ai-cluster-50mw.md) |
| Surviving path | Can one 700 kW gross path carry a 1 MW IT request? | 665 kW served; 335 kW unserved during the 600 s maintenance interval | [Continuity walkthrough](continuity-walkthrough.md) · [path_maintenance](../scenarios/path_maintenance.md) |
| Finite battery | How long does the 1 MW / 100 kWh reference battery last? | 307.8 s ride-through; depletion at 607.8 s; recovery at 900 s | [Continuity walkthrough](continuity-walkthrough.md) · [generator_failure](../scenarios/generator_failure.md) |
| Browser lesson | How do power, energy, and event boundaries relate? | Follow the first lesson, inspect the result, and optionally verify against Python | [Start power and energy](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy) · [course notes](power-systems-course.md) |

## Begin the runnable journey

- [Open the zero-install browser demo](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) with the AI-cluster case.
- [Start the 12-lesson browser course](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy) or read the [course guide](power-systems-course.md).
- [Use the quickstart](../quickstart.md) when you need the optional Python, uv, released-wheel, or source workflow.
- [Follow the recorded reference walkthrough](../examples/demo-walkthrough.md) to change reserve, replay a failure, and export a result; refresh the recorded asset if the controls or labels differ.

The default browser path uses exact JavaScript arithmetic. Select **Verify against Python** only for the optional on-demand Pyodide cross-check. The initial browser result does not need the Python runtime.

## Terms and support

Use the [unit-aware glossary](../scenarios/glossary.md) after the first run to distinguish power in kW from accumulated energy in kWh. Browse the [scenario catalog](../scenarios/index.md) to compare failures and recovery, and use the [contribution ideas](../scenarios/contribution-ideas.md) for a bounded next step.

## Assumptions and limits

The 50 MW case is a synthetic 50× scale-up of the verified 1 MW / 100 kWh fixture. The current model covers one aggregate IT load, explicit topology, finite stored energy, conversion losses, path limits, shared-domain events, event boundaries, deterministic replay, and exact energy accounting. It does not establish GPU throughput, grid adequacy, equipment selection, facility calibration, cooling, workload queues, battery aging, generator ramp/cooldown/fuel dynamics, transfer and switching transients, AC load flow, impedance-based sharing, protection coordination, harmonics, short-circuit or arc-flash studies, reliability probabilities, Tier claims, service-level claims, certification, physical controls, or physical safety.

The 1 MW reference fixture uses 1,000 kW IT demand, 1,800 s duration, 0.95 distribution efficiency, 100 kWh initial and maximum battery energy, 0.90 discharge efficiency, a 30 s generator start delay, 700 kW path capacities, and a fictional USD 0.10/kWh tariff. The 50 MW case scales demand and battery energy to 50,000 kW and 5,000 kWh with the same ratios. All ratings, demand, efficiency, event times, and tariff values are synthetic assumptions; they are not selected-equipment ratings, live prices, a benchmark, a certification, legal-compliance evidence, or a real-site calibration.

These examples demonstrate software behavior for synthetic fixtures. They do not establish facility reliability or physical validation. The browser has no shared simulation backend or client analytics; the API binds to loopback. Independent external review, formal security audit, shared deployment, facility measurements, and validation data remain absent. Unknown costs and unavailable quantities stay explicit.

Original code and synthetic fixtures use [Apache-2.0](../../LICENSE). See [NOTICE](../../NOTICE), [synthetic provenance](../../data/provenance/manifest.json), and [browser runtime licenses](../third-party/README.md).
