# Physics accounting and independent arithmetic — scope-limited

The Python engine `datacenter_twin/continuity.py` uses exact `fractions.Fraction` accounting. At each interval the ledger implementation calculates:

```text
grid_kWh + generator_kWh
= served_IT_kWh + battery_stored_change_kWh
  + distribution_loss_kWh + battery_charge_loss_kWh
  + battery_discharge_loss_kWh

requested_IT_kWh = served_IT_kWh + unserved_IT_kWh
```

The engine checks zero exact-rational residual and stored-energy bounds before serialization. This is a **source-code review**; it is not an independently executed full-physics regression. `docs/canonical-case.md` specifies decimal export residual acceptance below `1e-90 kWh` because serializing 100-significant-digit results is not exact rational text.

## Independent analytic fixtures from documented inputs

| Input | 100 kWh / charging off | 50 kWh / charging off |
| --- | ---: | ---: |
| IT demand | 1000 kW | 1000 kW |
| Battery discharge × distribution efficiency | 0.90 × 0.95 | 0.90 × 0.95 |
| Delivered energy | 85.5 kWh | 42.75 kWh |
| Ride-through from outage | 307.8 s | 153.9 s |
| Outage begins | 300 s elapsed | 300 s elapsed |
| Depletion | 607.8 s elapsed | 453.9 s elapsed |
| Recovery | 900 s elapsed | 900 s elapsed |
| Unserved energy | 81.166666… kWh | 123.916666… kWh |
| 1800 s requested energy | 500 kWh | 500 kWh |

Calculations: `E_delivered = E_initial × .90 × .95`; `t_ride = E_delivered / (1000 kW) × 3600 s/h`; `t_deplete = 300 + t_ride`; `E_unserved = 1000 × (900 - t_deplete) / 3600`. These predictions were independently reconstructed from the published inputs, *not* claimed as observed audit-branch simulation results.

Do not compare these charging-disabled course variants with the charging-enabled `generator_failure` preset at another opening state. The path-maintenance case documented in `docs/canonical-case.md` is `700 kW × .95 = 665 kW` served and `335 kW × 600/3600 = 55.83333… kWh` unserved.

## Model and standards boundaries

Continuity uses aggregate electrical power and stored energy, not modeled liquid loops, thermal storage, STS sub-cycle transfer, live SCADA, workload completion or certified Tier availability. Educational infrastructure thermal screens are separate and cannot be treated as calibration or ASHRAE/IEC/Uptime certification. No external certification/standards validation performed.

**Mandatory further evidence:** repeat native scenario runs and independent ledger reconstruction on the exact PR SHA; browser/native parity; non-finite/out-of-envelope inputs; independent numeric verifier if numerical algorithms ever change. No physics algorithm is changed by DTL-001.
