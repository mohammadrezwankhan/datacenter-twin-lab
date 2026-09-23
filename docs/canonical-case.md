# Canonical battery ride-through case

This reproduces lesson 3, “Calculate battery ride-through,” from the browser course. It starts with `demo_scenario("generator_failure")` and applies the lesson's exact recipe: `id="course-ride-through"`, `name="3. Calculate battery ride-through"`, append and deduplicate `EDU-POWER-001`, set charging to `0 kW`, and set initial stored energy to either `100 kWh` or `50 kWh`. Construction goes through `SiteScenario.from_dict`; the result is produced by `simulate_continuity`.

The inputs are synthetic: `1,000 kW` IT demand over `1,800 s`, utility and generator failure beginning at `300 s`, utility and generator recovery at `900 s`, `0.90` battery-discharge efficiency, and `0.95` distribution efficiency. No generator power or charging is available during the outage. The 100 kWh case is the lesson starting value; 50 kWh is its challenge value.

The independent prediction is:

```text
delivered battery energy = opening kWh × 0.90 × 0.95
ride-through seconds      = delivered battery energy ÷ 1,000 kW × 3,600
depletion elapsed time    = 300 s outage start + ride-through seconds
unserved kWh              = 1,000 kW × (900 s recovery − depletion time) ÷ 3,600
requested kWh             = 1,000 kW × 1,800 s ÷ 3,600 = 500 kWh
```

For `100 kWh`, delivered energy is `85.5 kWh`, ride-through is `307.8 s`, depletion is at `607.8 s` elapsed, and unserved energy is `81.166666… kWh`. For `50 kWh`, delivered energy is `42.75 kWh`, ride-through is `153.9 s`, depletion is at `453.9 s` elapsed, and unserved energy is `123.916666… kWh`. Ride-through is a duration measured from the `300 s` outage boundary; depletion elapsed time is an event timestamp. They are different quantities.

The third packet case is the existing `path_maintenance` preset. Path A is down from `300 s` to `900 s`; the surviving path's `700 kW` gross rating at `0.95` distribution efficiency serves `665 kW`. The remaining `335 kW` deficit over `600 s` is `55.833333… kWh` unserved. This follows the existing [scenario explanation](scenarios/path_maintenance.md).

Predict before running, then compare both canonical variants and the path case:

```sh
python scripts/build_evidence.py --output outputs/reproduction-0.4.0rc1 \
  --revision <public-commit-or-tag> \
  --repository mohammadrezwankhan/datacenter-twin-lab
python scripts/build_evidence.py --verify outputs/reproduction-0.4.0rc1
```

The receipt prints equations beside expected and observed values. The packet includes the complete interval records so a reviewer can independently sum the ledger terms. The validator deliberately ignores each reported residual field. For each interval and for the whole run, reconstruct:

```text
grid kWh + generator kWh
= served IT kWh + battery stored-energy change
  + distribution loss + battery charge loss + battery discharge loss
requested IT kWh = served IT kWh + unserved IT kWh
```

Sum these terms from `intervals[*].energy` as exact fractions of their decimal strings. Independently check battery opening/closing values against the stored-energy change. Exported strings use a 100-significant-digit, round-half-even context; the packet allows an absolute difference below `1e-90` in the relevant displayed unit to account for decimal serialization. `energy_balance_residual_kwh` is shown in the report for comparison, but is not used in this reconstruction.

The expected lesson behavior is also captured by the browser source [`course-lessons.ts`](../apps/web/src/course-lessons.ts) and native test [`test_course_lessons.py`](../tests/test_course_lessons.py). The independent review boundary and required reviewer observations remain defined by the [review protocol](validation/review-protocol.md). No independent external review has been obtained; this procedure and its maintainer-produced packet are not that review.
