# Power systems continuity course

**Twelve short browser lessons for datacenter engineers learning how power, energy, storage, and continuity events fit together.**

Start with the [power and energy lesson](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy), then use the lesson selector or **Next lesson**. Each lesson has one input, a challenge value, a worked answer, and a result you can inspect in the browser.

## The headline result

The AI-outage lesson uses a synthetic aggregate **50,000 kW (50 MW)** IT request and **5,000 kWh (5 MWh)** initial stored battery energy. Utility and generator supply fail at 300 s. With 0.90 battery discharge efficiency and 0.95 distribution efficiency:

```text
total modeled efficiency = 0.90 × 0.95 = 0.855
IT-boundary reserve      = 5,000 kWh × 0.855 = 4,275 kWh
ride-through             = 4,275 kWh / 50,000 kW × 3,600 s/h
                         = 307.8 s
battery depletion       = 300 s + 307.8 s = 607.8 s
```

The utility restoration event is at 900 s, leaving `900 − 607.8 = 292.2 s` after depletion. If the aggregate request stays at 50,000 kW, that interval contains:

```text
unserved IT energy = 50,000 kW × 292.2 s / 3,600 s/h
                   = 4,058.333333... kWh
```

The calculation is a scaled teaching fixture. It answers how the declared reserve and efficiencies behave in this event sequence; it does not infer GPU throughput, job completion, grid adequacy, or site performance.

## Run the lessons

1. Open the [course at lesson 1](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy).
2. Predict the challenge value shown by the lesson, then select **Try the challenge value** and **Run lesson**.
3. Open **Show worked answer**, compare the displayed result and energy-balance residual, and move to the next lesson.
4. Jump directly to [the 50 MW AI-outage lesson](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=ai-outage).

The browser course needs no installation or account. The default calculation uses exact JavaScript arithmetic. **Verify against Python** is an optional action on a completed run; it loads the Python runtime only when selected.

## Lesson map

For lesson 3, use the [printable battery ride-through worksheet](battery-ride-through-worksheet.md)
to write a prediction before checking the worked answer on a separate page.

| # | Lesson and link | Question | Default → challenge | Expected check |
| ---: | --- | --- | --- | --- |
| 1 | [Power becomes energy](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy) | How much energy does a constant load request in half an hour? | 1,000 → 500 kW | `1,000 × 0.5 = 500 kWh`; the challenge gives 250 kWh. |
| 2 | [Account for distribution losses](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=distribution-loss) | How much source power is needed to deliver 1,000 kW? | 0.95 → 0.90 ratio | `1,000 / 0.95 = 1,052.631... kW`; at 0.90 it is `1,111.111... kW`. |
| 3 | [Calculate battery ride-through](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=ride-through) | Does half the stored energy give half the ride-through duration? | 100 → 50 kWh | Charging is disabled for this lesson: depletion is 607.8 s → 453.9 s. |
| 4 | [Bridge generator startup](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=generator-delay) | What changes when startup takes 60 seconds instead of 30? | 30 → 60 s | Generator-ready event moves from 330 s to 360 s; the battery bridges both inputs. |
| 5 | [Add a failed generator](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=generator-failure) | What changes if the generator cannot start? | Failed → available | Failed case depletes at 607.8 s with 292.2 s unserved; available generation starts at 330 s. |
| 6 | [Check a surviving path](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=n-plus-one) | Can either path carry the whole 1 MW load? | 700 → 1,100 kW gross path | `700 × 0.95 = 665 kW`, leaving 335 kW; 1,100 kW gross supplies the full request after loss. |
| 7 | [Expose shared control failures](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=shared-controls) | Can a shared control fault defeat both paths? | Shared → removed from Path B | Both paths unavailable gives 1,000 kW unmet; removing the dependency leaves 665 kW served. |
| 8 | [Find a single point of failure](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=single-point) | What happens when the common main bus fails? | Failed → available | A 600 s outage gives `1,000 × 600/3,600 = 166.666... kWh` unserved. |
| 9 | [Track energy before the outage](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=precharge) | Why can a 50 kWh case last longer when it charges first? | 100 → 0 kW charging | Pre-outage charging adds `100 × 300/3,600 × 0.95 = 7.9166... kWh`; depletion is 478.2675 s → 453.9 s. |
| 10 | [Interrupt a 50 MW AI cluster](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=ai-outage) | How long can 5 MWh bridge a 50 MW load? | 5,000 → 2,500 kWh | Full reserve depletes at 607.8 s; the half-reserve challenge, with pre-outage charging, depletes at 478.2675 s. |
| 11 | [Catch a sub-second service gap](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=recovery-deadline) | Does 57 kWh bridge recovery at 500 s? Does 58 kWh? | 57 → 58 kWh | 57 kWh depletes at 499.8135 s, leaving 0.1865 s unserved; 58 kWh bridges the event. |
| 12 | [Separate PUE from continuity](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=pue) | How does assumed PUE change annual energy for the same 50 MW IT load? | 1.25 → 1.15 ratio | `50,000 × 8,760 × 1.25 = 547,500,000 kWh`; at 1.15 it is 503,700,000 kWh. |

The lesson values above are the course defaults and challenge values. Other values can change event order, service gaps, and the reported ledger; read the result's assumptions and input hash with the number.

## Reproduce the reference calculations with the CLI

The public CLI accepts the original reference presets and the two AI-cluster presets. These commands use the documented `simulate` syntax and write Markdown reports to new paths:

```sh
python -m datacenter_twin simulate --preset generator_failure --format markdown --output outputs/course-generator-failure.md
python -m datacenter_twin simulate --preset path_maintenance --format markdown --output outputs/course-path-maintenance.md
python -m datacenter_twin simulate --preset ai_cluster_generator_failure --format markdown --output outputs/course-ai-generator-failure.md
python -m datacenter_twin simulate --preset ai_cluster_utility_loss --format markdown --output outputs/course-ai-utility-loss.md
python -m unittest discover -s tests -p test_continuity.py -v
```

The first report reproduces the 1 MW / 100 kWh calculation: 307.8 s of battery ride-through and depletion at 607.8 s. The second checks `700 kW × 0.95 = 665 kW` served and `335 kW` unserved during the 600 s maintenance interval. Choose new output paths or add `--force` when replacing an existing report.

For the 50 MW case, use the browser's [AI-outage lesson](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=ai-outage) or either AI-cluster CLI command above. The lesson selects the implemented `ai_cluster_generator_failure` scenario and exposes the inputs and result without requiring a source checkout.

## Assumptions and limits

The lessons use synthetic electrical and planning exercises. The 50 MW examples represent one aggregate requested IT load. They do not model GPU jobs, workload queues, cooling, grid adequacy, AC transients, protection coordination, facility safety, reliability probabilities, selected equipment, or certified uptime. The N+1 lesson tests a path-capacity condition only. The PUE lesson is a separate annual energy calculation; do not add its overhead to the continuity losses a second time.

The 1 MW reference fixture uses 1,000 kW IT demand, 100 kWh initial and maximum battery energy, 0.90 discharge efficiency, 0.95 distribution efficiency, a 30 s generator start delay, 700 kW gross paths, and explicit 300 s / 900 s events. The AI-cluster case scales the aggregate electrical quantities and storage by 50× while retaining the timing and modeled ratios. These are assumptions, not facility measurements, live prices, grid studies, or equipment ratings.

No physical controls or external telemetry are used. The browser has no shared simulation backend or client analytics, and the local API binds to loopback. Independent external technical review, formal security audit, facility calibration, and real-site validation are absent. Lesson completion is not collected. Unknown costs and unavailable quantities remain explicit in exports.

The course uses the repository's original synthetic fixtures and code under [Apache-2.0](../../LICENSE). See [NOTICE](../../NOTICE), [synthetic provenance](../../data/provenance/manifest.json), and [browser runtime licenses](../third-party/README.md).
