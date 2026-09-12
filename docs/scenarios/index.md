# Scenario catalog

**Question:** what does an explicit power-continuity model show for a 50 MW aggregate AI-cluster load and for the smaller reference failures behind it?

The browser AI-cluster case uses **50,000 kW (50 MW)** IT demand and **5,000 kWh (5 MWh)** initial battery energy. With the same 0.90 discharge and 0.95 distribution efficiencies as the verified 1 MW fixture, the synthetic battery supplies IT for **307.8 s**, depletes at **607.8 s**, and utility restores service at **900 s**.

## Runnable cases

| Preset | Start with this question | Event | Expected service result | Runnable route |
| --- | --- | --- | --- | --- |
| `ai_cluster_generator_failure` | How long does a 5 MWh reserve support a 50 MW aggregate load? | Utility and generator down at 300 s; restored at 900 s | 307.8 s ride-through; depletion at 607.8 s; the same scaled loss ratios as the 1 MW fixture | [Browser preset](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?preset=ai_cluster_generator_failure) |
| [`normal`](normal.md) | What happens with healthy 1 MW supply? | No outage events | 500 kWh served; 0 kWh unserved; battery ends at 100 kWh | `python -m datacenter_twin simulate --preset normal` |
| [`utility_loss`](utility_loss.md) | Can the 1 MW battery bridge generator startup? | Utility down at 300 s; utility restored at 900 s | Generator is requested at 300 s and ready at 330 s; all 500 kWh served; 0 s unserved | `python -m datacenter_twin simulate --preset utility_loss` |
| [`generator_failure`](generator_failure.md) | What if the 1 MW generator also fails? | Utility and generator down at 300 s; restored at 900 s | Battery depletes at 607.8 s; 292.2 s unserved; 81.166666... kWh unserved; final battery 23.75 kWh | `python -m datacenter_twin simulate --preset generator_failure` |
| [`path_maintenance`](path_maintenance.md) | Can one surviving path carry the 1 MW load? | Path A down at 300 s; restored at 900 s | Surviving path serves 665 kW; 335 kW unserved for 600 s; 55.833333... kWh unserved; battery remains 100 kWh | `python -m datacenter_twin simulate --preset path_maintenance` |
| [`shared_domain`](shared_domain.md) | What if both paths share a failed control domain? | Shared controls down at 300 s; restored at 900 s | Both paths unavailable; 1,000 kW unserved for 600 s; 166.666666... kWh unserved | `python -m datacenter_twin simulate --preset shared_domain` |

The AI-cluster row is the scaled browser teaching case; the five original rows remain the Python CLI regression fixtures. For a runnable browser first step, open the [GitHub Pages demo](https://mohammadrezwankhan.github.io/datacenter-twin-lab/); for the 1 MW route, use [`?preset=generator_failure`](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?preset=generator_failure).

## Run the reference cases together

Run the five original presets from the repository root with Python 3.12 or later:

```sh
python -m datacenter_twin simulate --preset normal
python -m datacenter_twin simulate --preset utility_loss
python -m datacenter_twin simulate --preset generator_failure
python -m datacenter_twin simulate --preset path_maintenance
python -m datacenter_twin simulate --preset shared_domain
```

Each run reports a stable input hash, event log, interval energy ledger, units, warnings, and an explicit synthetic/uncalibrated boundary. For the five reference fixtures, the default input is a 1,000 kW IT request, 1,800 s duration, 0.95 distribution efficiency, 100 kWh initial battery energy, 0.90 discharge efficiency, and a 30 s generator start delay.

## Terms and support

New to the electrical terms? Use the [unit-aware glossary and kW/kWh example](glossary.md) after the first run. For a complete hand calculation, see the [battery ride-through teaching notebook](../examples/battery-ride-through.ipynb), its [running instructions](../examples/battery-ride-through.md), and the [continuity walkthrough](../tutorials/continuity-walkthrough.md). The [quickstart](../quickstart.md) starts with the browser case before installation mechanics.

## Read the diagrams

The diagrams show the same synthetic topology used by the reference presets. Events change asset or domain availability at explicit boundaries; they do not model switching transients or protection behavior.

## Propose a new case

Use the [scenario proposal issue form](https://github.com/mohammadrezwankhan/datacenter-twin-lab/issues/new?template=scenario-proposal.yml), or start with the [beginner ideas](contribution-ideas.md). Include units, synthetic assumptions, a hand calculation, non-goals, and a testable expected result.

## Assumptions and limits

The scenario catalog models one synthetic aggregate IT load, explicit electrical topology, finite stored energy, generator delay/failure, conversion losses, path limits, shared-domain events, deterministic recovery, and exact energy accounting. It does not represent selected equipment, a facility, GPU throughput, grid adequacy, a workload, cooling, battery aging, generator fuel/ramp/cooldown, AC transients, load flow, impedance-based sharing, protection coordination, harmonics, short-circuit or arc-flash behavior, reliability probabilities, certification, physical controls, legal compliance, or a safety assessment.

The 50 MW AI-cluster case scales the 1 MW / 100 kWh teaching fixture by 50× to 50,000 kW / 5,000 kWh and keeps the same ratios. All demand, capacity, efficiency, event-time, and fictional tariff values are synthetic assumptions. They are not live prices, account quotes, equipment ratings, a performance benchmark, or a real-site calibration. Unknown costs and unavailable quantities remain explicit.

The browser default is exact JavaScript arithmetic; **Verify against Python** is an optional on-demand Pyodide cross-check when supplied by the deployed build. The browser has no shared simulation backend or client analytics, and the API binds to loopback. Independent external review, formal security audit, shared deployment, facility measurements, and validation data remain absent. The verified reference runs report `energy_balance_residual_kwh: "0"`; the AI-cluster row awaits the parent browser proof.

Original code and synthetic fixtures use [Apache-2.0](../../LICENSE). See [NOTICE](../../NOTICE), [synthetic provenance](../../data/provenance/manifest.json), and [browser runtime licenses](../third-party/README.md).
