# 50 MW aggregate AI-cluster continuity case

**Question:** when a synthetic 50 MW aggregate IT load loses utility and generator supply, how long does a 5 MWh battery reserve support the IT boundary?

The answer for this fixture is **307.8 s of battery ride-through**. The outage starts at **300 s**, so the battery-depleted event is at **607.8 s**. Utility and generator restoration is scheduled for **900 s**.

## Run the case in the browser

- [Open the default AI-cluster case](https://mohammadrezwankhan.github.io/datacenter-twin-lab/), which selects `ai_cluster_generator_failure`.
- [Open the generator-failure preset directly](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?preset=ai_cluster_generator_failure).
- [Try utility loss with generator pickup](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?preset=ai_cluster_utility_loss).
- [Study the same scale in lesson 10](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=ai-outage), then [start the full course](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy).

Run the case, select the **Battery depleted 607.8 s** event, and inspect the interval after depletion. Served IT power is zero until the utility restoration event at 900 s. The browser's default calculation uses exact JavaScript arithmetic; **Verify against Python** is an optional action after a run.

## Inputs and scaled electrical quantities

The preset starts from the repository's synthetic 1 MW reference graph and scales the aggregate electrical quantities by 50. The timing inputs and efficiency ratios stay unchanged.

| Quantity | AI-cluster fixture | Unit | How to read it |
| --- | ---: | --- | --- |
| Requested IT demand | 50,000 | kW (50 MW) | Aggregate electrical demand at the IT boundary. |
| IT capacity | 50,000 | kW | Declared capacity for the aggregate request. |
| Initial and maximum stored battery energy | 5,000 | kWh (5 MWh) | Stored energy before discharge and distribution losses. |
| Battery power capacity | 60,000 | kW | Scaled synthetic battery asset limit. |
| Battery charge power | 5,000 | kW | Maximum modeled charging input before charge efficiency. |
| Battery discharge efficiency | 0.90 | ratio | Fraction retained through modeled battery discharge. |
| Distribution efficiency | 0.95 | ratio | Fraction of dispatched gross path power reaching the IT boundary. |
| Utility capacity | 75,000 | kW | Scaled synthetic source capacity. |
| Generator capacity | 60,000 | kW | Scaled synthetic source capacity. |
| Each distribution path | 35,000 gross | kW | A single path can deliver at most 33,250 kW after 0.95 distribution efficiency. |
| Generator start delay | 30 | s | Applies when the utility-loss case requests generator pickup. |
| Utility loss / restoration | 300 / 900 | s elapsed | Explicit event boundaries shared by the two AI presets. |

These are fixture inputs for a continuity lesson. They are not selected equipment, a facility design, a GPU-cluster specification, or a grid connection study.

The preset retains the reference fixture's `DEMO-ELECTRICAL-002` provenance and adds the synthetic scale-case identifier `SYN-AI-50MW-001`. These identifiers describe the input records; they are not vendor or facility sources.

## Independent calculation: generator failure

The modeled battery and distribution losses combine multiplicatively:

```text
total modeled efficiency = 0.90 × 0.95 = 0.855
IT-boundary reserve      = 5,000 kWh × 0.855 = 4,275 kWh
ride-through             = 4,275 kWh / 50,000 kW × 3,600 s/h
                         = 307.8 s
battery depletion       = 300 s + 307.8 s = 607.8 s
```

After depletion, the load remains unserved until the 900 s restoration boundary:

```text
unserved duration       = 900 s − 607.8 s = 292.2 s
unserved IT energy      = 50,000 kW × 292.2 s / 3,600 s/h
                        = 4,058.333333... kWh
```

The same result can be checked by scaling the reference fixture: `100 kWh × 50 = 5,000 kWh`, `1,000 kW × 50 = 50,000 kW`, and the power/energy ratio remains unchanged. This is an arithmetic scale check, not a claim that a real 50 MW site behaves like the fixture.

## Independent calculation: utility loss and generator pickup

The `ai_cluster_utility_loss` preset removes utility supply at 300 s and restores it at 900 s. The generator is ready after its 30 s start delay, at **330 s**. The battery bridges that interval:

```text
IT energy bridged = 50,000 kW × 30 s / 3,600 s/h
                  = 416.666666... kWh at the IT boundary
```

The fixture's source and path capacities allow that declared aggregate request in this case. Inspect the event log and energy ledger in the browser result to distinguish the 30 s bridge from the longer generator-failure outage.

## Compare with the 1 MW reference

The original Python CLI presets remain useful for an independently runnable calculation:

```sh
python -m datacenter_twin simulate --preset generator_failure --format markdown --output outputs/one-mw-generator-failure.md
python -m datacenter_twin simulate --preset utility_loss --format markdown --output outputs/one-mw-utility-loss.md
python -m datacenter_twin simulate --preset ai_cluster_generator_failure --format markdown --output outputs/ai-generator-failure.md
python -m datacenter_twin simulate --preset ai_cluster_utility_loss --format markdown --output outputs/ai-utility-loss.md
```

The first two commands use the 1,000 kW / 100 kWh reference cases; the latter two run the 50,000 kW / 5,000 kWh AI-cluster cases. The [course page](../tutorials/power-systems-course.md) lists all twelve browser lessons and the [continuity walkthrough](../tutorials/continuity-walkthrough.md) derives the reference battery and path calculations. Use a new output path or add `--force` if an output already exists.

The AI preset definitions are in [`datacenter_twin/demo.py`](../../datacenter_twin/demo.py), and the CLI exposes them through the same `simulate --preset` command as the reference cases.

## Assumptions and limits

This case models one aggregate electrical IT load. It does not simulate individual GPU jobs, workload scheduling, throughput, cooling, temperature, battery aging, generator ramp/cooldown/fuel dynamics, transfer and switching transients, AC load flow, impedance-based sharing, protection coordination, harmonics, short-circuit or arc-flash studies, reliability probabilities, Tier claims, service-level claims, grid adequacy, facility safety, or certified uptime.

The 50 MW and 5 MWh values are a 50× scale of the synthetic reference graph. The 0.90 battery efficiency, 0.95 distribution efficiency, path limits, event times, and fictional tariff are assumptions. They are not live prices, account quotes, selected equipment ratings, facility measurements, a performance benchmark, a legal-compliance result, or a site calibration. Unknown costs and unavailable quantities remain explicit.

The browser has no shared simulation backend or client analytics, and the local API binds to loopback. No physical controls or external telemetry are used. Independent external technical review, formal security audit, facility calibration, FAT/SAT, and real-site validation are absent. A result can be internally consistent with the fixture and still be unsuitable as an engineering decision by itself.

See the [schema-2 electrical contract](../contracts/electrical-v2.md), [synthetic provenance manifest](../../data/provenance/manifest.json), [Apache-2.0 license](../../LICENSE), [NOTICE](../../NOTICE), and [browser runtime licenses](../third-party/README.md).
