# More battery energy cannot remove a power bottleneck

**A battery can retain energy while part of a load remains unserved.** In this
exercise, a synthetic 200 kWh battery with a 600 kW electrical output limit can
deliver only **570 kW** to a 1,000 kW IT load after distribution losses. Doubling
the stored energy keeps that partial supply running longer; it does not raise
the output limit.

This worked extension to the [demand-timing lesson](demand-timing.md) is for
electrical/infrastructure engineers, Python learners and engineering educators.
It uses the existing continuity engine with four downloadable inputs. No model
change, equipment selection or facility measurement is involved.

## Predict before running

Compare a two-by-two experiment: **100 or 200 kWh** of initial stored energy,
and a battery electrical output rating of **600 or 1,200 kW**. In every case:

- IT demand is a constant **1,000 kW** over **1,800 s**.
- Utility and generator are unavailable from **300 s up to 900 s**.
- Battery charging is **disabled**, including before the outage and after recovery.
- Battery discharge efficiency is **0.90**; distribution efficiency is **0.95**.
- Both **700 kW** distribution paths remain available.
- Maximum stored energy equals the initial reserve. Energy prices are unspecified.

Write a prediction for each case before reading the results:

1. Can the battery deliver the full 1,000 kW request at the start of the outage?
2. Will the battery deplete before utility recovery?
3. Which single change would remove the limiting constraint in that case?

The battery's `assets[].capacity_kw` is its electrical output limit **before
distribution loss**. Discharge efficiency determines how quickly stored energy
is consumed. It is not a second multiplier on that output rating. The
[electrical contract](../engineering/electrical-continuity.md) describes this
boundary.

## Run the four cases

Use Python 3.12 or later in a checkout of the [public repository](../../README.md).
The runner needs only Python's standard library and this source tree. If you
already have a checkout, open its root; otherwise follow the
[source quickstart](../quickstart.md#run-from-source).

```sh
git rev-parse HEAD
python --version
python scripts/reproduce_battery_limits.py --output outputs/battery-limits
```

Keep the printed commit and Python version with your results. The runner checks
all four cases against independent rational expectations before writing JSON,
Markdown and HTML reports plus `manifest.json`. It reconstructs energy and
stored reserve from the actual interval boundaries, checks partial-service
power and depletion events, and verifies that unknown cost stays unknown. It
does not rely on the engine's energy-balance residual as proof of the lesson.

Choose a fresh output directory for every run. An existing directory is refused
without replacing its files. The manifest records the engine version, input
file SHA-256, canonical input SHA-256, run ID and output file hashes. The two
input hashes describe different things: exact file bytes versus canonical
scenario content. The JSON reports contain the raw result; the ordinary CLI
below wraps its result in a `result` field.

| Initial / maximum storage | Battery output rating | Downloadable input |
| --- | --- | --- |
| 100 kWh | 600 kW | [100kwh-600kw.json](../examples/battery-limits/100kwh-600kw.json) |
| 100 kWh | 1,200 kW | [100kwh-1200kw.json](../examples/battery-limits/100kwh-1200kw.json) |
| 200 kWh | 600 kW | [200kwh-600kw.json](../examples/battery-limits/200kwh-600kw.json) |
| 200 kWh | 1,200 kW | [200kwh-1200kw.json](../examples/battery-limits/200kwh-1200kw.json) |

For one case, the existing CLI can read the downloaded input using the
[installed Python core](../quickstart.md#install-the-python-core-from-pypi):

```sh
python -m datacenter_twin simulate --scenario docs/examples/battery-limits/200kwh-600kw.json --format markdown
```

That relative path assumes the source checkout. If you downloaded only the JSON,
replace it with your saved file's path. The reproduction runner and these new
fixtures are source files, not additions to historical release archives.

For the existing browser route, download an input using GitHub's **Raw** view,
open the [advanced workspace](https://khanlab.co.technology/?mode=advanced),
select **Import scenario**, review the inputs and select **Run imported
scenario**. These are schema-2 inputs; they add no new named preset or course
module. See the [import guide](../engineering/energy-scenario-workspace.md#reopen-a-saved-experiment).

## Compare the outcomes

All four cases request **500 kWh** over the full run, including **166.6667 kWh**
during the 600 s outage. Values below are rounded only for display.

| Case | IT power served during outage | Battery depletion, elapsed time | Time with any shortfall | Unserved IT energy | Stored energy at recovery |
| --- | --- | --- | ---: | ---: | ---: |
| 100 kWh / 600 kW | 570 kW until 840 s; then 0 kW | 840 s | 600 s | 81.1667 kWh | 0 kWh |
| 100 kWh / 1,200 kW | 1,000 kW until 607.8 s; then 0 kW | 607.8 s | 292.2 s | 81.1667 kWh | 0 kWh |
| 200 kWh / 600 kW | 570 kW throughout | No depletion | 600 s | 71.6667 kWh | 88.8889 kWh |
| 200 kWh / 1,200 kW | 1,000 kW throughout | No depletion | 0 s | 0 kWh | 5.0682 kWh |

**Read duration carefully.** `unserved_duration_s` counts any interval with a
positive shortfall, including partial service. It is not a duration of total
blackout. The 100 kWh / 600 kW case has partial service for 540 s and no service
for 60 s; its any-shortfall duration is the whole 600 s outage.

The 100 kWh / 1,200 kW case supplies the full request for **307.8 s after the
outage begins**, then depletes at **607.8 s elapsed**. The 600 kW cases never supply the
full request during this outage. The 200 kWh / 1,200 kW case supplies the full
request for the complete **600 s observation window**; its battery does not
deplete in this run. Do not turn that bounded observation into an infinite
runtime or reliability claim.

Because charging remains disabled, the reserve at recovery is also the reserve
at the end of the 1,800 s simulation. Utility serves the full request outside
the outage, so all unserved energy occurs within it.

## Check the result by hand

### 1. Check power before calculating runtime

For this intact topology, battery-only IT power is bounded by the request, the
battery output rating and the available distribution paths:

```text
served IT power = min(1,000, battery output rating × 0.95,
                      (700 + 700) × 0.95) kW
```

At **600 kW**, the battery permits only `600 × 0.95 = 570 kW` at IT. The
shortfall is **430 kW**, regardless of how many kWh remain. At **1,200 kW**, the
available battery and distribution power exceed the 1,000 kW request. The
engine supplies the request, drawing `1,000 / 0.95 ≈ 1,052.6316 kW` from the
battery's electrical output. It does not dispatch 1,200 kW unnecessarily.

### 2. Check how long stored energy can supply that power

The initial reserve available at the IT boundary is:

```text
100 kWh × 0.90 × 0.95 = 85.5 kWh
200 kWh × 0.90 × 0.95 = 171 kWh
```

For **100 kWh / 1,200 kW**, `85.5 / 1,000 × 3,600 = 307.8 s` of full-load
supply gives depletion at `300 + 307.8 = 607.8 s`. The remaining `292.2 s`
requests `1,000 × 292.2 / 3,600 = 487/6 kWh`, about **81.1667 kWh**, unserved.

For **100 kWh / 600 kW**, the battery delivers only 570 kW to IT. Its energy
lasts `85.5 / 570 × 3,600 = 540 s`, giving depletion at **840 s elapsed**.
Unserved energy has two pieces:

```text
partial-service shortfall = 430 kW × 540 s / 3,600 = 64.5 kWh
after depletion          = 1,000 kW × 60 s / 3,600 = 50/3 kWh
total                    = 487/6 kWh ≈ 81.1667 kWh
```

The two 100 kWh cases therefore have equal unserved energy but different
service histories. A single aggregate energy quantity cannot describe whether
the full requested power was available at a particular time.

### 3. Explain the remaining reserve

For **200 kWh / 600 kW**, battery output over the outage is
`600 × 600 / 3,600 = 100 kWh`. Removing that electrical energy consumes
`100 / 0.90 = 1,000/9 kWh` of stored energy. The remaining reserve is
`200 − 1,000/9 = 800/9 kWh`, about **88.8889 kWh**. Yet the power shortfall
persists for 600 s, losing `430 × 600 / 3,600 = 215/3 kWh`, about **71.6667 kWh**.

For **200 kWh / 1,200 kW**, the outage requests `1,000 × 600 / 3,600 = 500/3 kWh`
at IT. Stored energy consumed is `(500/3) / (0.90 × 0.95) = 100,000/513 kWh`.
The remaining reserve is `200 − 100,000/513 = 2,600/513 kWh`, about
**5.0682 kWh**. Both power and energy are sufficient for this bounded interval.

## Try one controlled change

Copy the **200 kWh / 600 kW** JSON and change both `battery_initial_kwh` and
`battery_capacity_kwh` to `"400"`. Keep the 600 kW asset rating and other inputs
unchanged. Predict the served power, shortfall and remaining stored energy,
then run your copy with the ordinary CLI.

The predicted outcome is still **570 kW served** and **71.6667 kWh unserved**
during the outage. The additional 200 kWh remains stored, giving about
**288.8889 kWh** at recovery. The supplied reproduction runner checks only its
four original fixtures; use the CLI for your edited scenario and keep its new
input hash. An edited identity or provenance field also changes that hash.

For an educator, ask learners to explain why “the battery lasted longer” is
an incomplete account of the two 100 kWh cases. A satisfactory explanation
separates power, delivered energy, full-demand coverage and elapsed depletion.
The result table and derivations form the answer key; no learner study or
teaching-effectiveness measurement is claimed.

If a command or lesson step fails, the existing
[first-run help form](https://github.com/mohammadrezwankhan/datacenter-twin-lab/issues/new/choose)
can capture the confusing step. If you choose to share a numerical comparison,
include the case, revision, expected calculation and observed quantity with
units. Remove private paths, credentials and facility details. Sharing is
optional; this exercise performs no telemetry or automatic submission.

## Scope, provenance and verification

These are original synthetic educational inputs, recorded as
`EDU-BATTERY-LIMITS-001` in the [provenance manifest](../../data/provenance/manifest.json)
under [Apache-2.0](../../LICENSE). They extend the public reference fixture and
change only case identity, initial/maximum stored energy, battery output rating
and documented provenance between the controlled cases. They use no private
planning material, customer traces, vendor curves or licensed standards text.

The exercise does not model battery voltage, current, aging, temperature,
converter dynamics, transfer transients, protection coordination, cooling,
workload throughput or stochastic reliability. It does not size equipment,
validate a facility, control hardware, establish certified uptime or lift the
existing Engineering HOLD. Unknown prices remain unknown, rather than zero.

Run the lesson checks from the checkout with:

```sh
python -m unittest tests.test_battery_limits_lesson -v
```

The [runner](../../scripts/reproduce_battery_limits.py), hand calculations and
automated tests are maintainer evidence of behavior on these synthetic inputs.
They are not an [independent external review](../validation/review-protocol.md).
The original continuity tutorial, companion, release archives and engine remain
unchanged.
