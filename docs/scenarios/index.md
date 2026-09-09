# Scenario catalog

These five presets are the bundled schema-2 synthetic continuity cases. Run them from the repository root with Python 3.12 or later:

```sh
python -m datacenter_twin simulate --preset normal
python -m datacenter_twin simulate --preset utility_loss
python -m datacenter_twin simulate --preset generator_failure
python -m datacenter_twin simulate --preset path_maintenance
python -m datacenter_twin simulate --preset shared_domain
```

Each run reports a stable input hash, event log, interval energy ledger, units, warnings, and an explicit synthetic/uncalibrated boundary. The default fixture has a 1,000 kW IT request, 1,800 s duration, 0.95 distribution efficiency, 100 kWh initial battery energy, 0.90 discharge efficiency, and a 30 s generator start delay. The scenarios are teaching and regression fixtures; they do not represent equipment ratings, a facility, a workload, cooling, AC transients, certification, or physical controls.

| Preset | Event | Expected service result | Hand calculation / check |
| --- | --- | --- | --- |
| [`normal`](normal.md) | No outage events | 500 kWh served; 0 kWh unserved; battery ends at 100 kWh | `1,000 kW × 0.5 h = 500 kWh`; gross input is `1,000 / 0.95 = 1,052.631... kW` |
| [`utility_loss`](utility_loss.md) | Utility down at 300 s; utility restored at 900 s | Generator is requested at 300 s and ready at 330 s; all 500 kWh served; 0 s unserved | Battery bridges 30 s: `1,000 kW × 30/3,600 h = 8.333... kWh` at the IT boundary |
| [`generator_failure`](generator_failure.md) | Utility and generator down at 300 s; restored at 900 s | Battery depletes at 607.8 s; 292.2 s unserved; 81.166666... kWh unserved; final battery 23.75 kWh | `100 × 0.90 × 0.95 = 85.5 kWh`; `85.5 / 1,000 × 3,600 = 307.8 s`; `900 − 607.8 = 292.2 s` |
| [`path_maintenance`](path_maintenance.md) | Path A down at 300 s; restored at 900 s | Surviving path serves 665 kW; 335 kW unserved for 600 s; 55.833333... kWh unserved; battery remains 100 kWh | `700 kW × 0.95 = 665 kW`; `335 × 600/3,600 = 55.833333... kWh` |
| [`shared_domain`](shared_domain.md) | Shared controls down at 300 s; restored at 900 s | Both paths unavailable; 1,000 kW unserved for 600 s; 166.666666... kWh unserved | `1,000 × 600/3,600 = 166.666666... kWh`; battery has no available path through the domain |

The expected values above were checked by running the current engine and independently deriving the simple boundary calculations. Every verified run reported `energy_balance_residual_kwh: "0"`. See the relevant test names in [`tests/test_continuity.py`](../../tests/test_continuity.py).

## Read the diagrams

The diagrams show the same synthetic topology used by each preset. Events change asset or domain availability at explicit boundaries; they do not model switching transients or protection behavior.

## Propose a new case

Use the [scenario proposal issue form](https://github.com/mohammadrezwankhan/datacenter-twin-lab/issues/new?template=scenario-proposal.yml), or start with the [beginner ideas](contribution-ideas.md). Include units, synthetic assumptions, a hand calculation, non-goals, and a testable expected result.
