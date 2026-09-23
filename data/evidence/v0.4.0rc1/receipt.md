# Synthetic continuity reproduction receipt

Engine version: `0.4.0rc1`.

This is maintainer-generated synthetic evidence. Independent external review: **not obtained**.
No facility, equipment, cooling, workload, certification, or physical-control behavior is validated.

Public context supplied by the packet operator:
- repository: `mohammadrezwankhan/datacenter-twin-lab`

| Case | Input SHA-256 | Run ID |
| --- | --- | --- |
| `canonical-1mw-100kwh` | `a11b0d4078daef9a79e07f7969940203c23ccaa800c0a2c60cc5853b0acacfd0` | `d179c72e4b72afdb8b9d` |
| `canonical-1mw-50kwh` | `0db72b981fa59c8a566e5610fd8627f4c623baeb8bb2662d22c5cae246a2b8b9` | `21cd49da247b309f2b45` |
| `path-maintenance-700kw` | `6b446789e2f755b9ac1ac81896c7f0d85827a9a03b6ceedfd8fbdc6cb3b775dd` | `ad6fc2898ce61f96406c` |

## canonical-1mw-100kwh

| Measure | Independent equation | Expected | Observed |
| --- | --- | --- | --- |
| requested_it_kwh (kWh) | 1000 kW × 1800 s ÷ 3,600 | 500 | 500 |
| ride_through_s (s) | (100 kWh × 0.9 × 0.95) ÷ 1000 kW × 3,600 | 307.8 | 307.8 |
| depletion_elapsed_s (s) | 300 s outage start + ride-through | 607.8 | 607.8 |
| unserved_duration_s (s) | 900 s recovery − depletion elapsed | 292.2 | 292.2 |
| unserved_it_kwh (kWh) | 1000 kW × unserved seconds ÷ 3,600 | 81.166666666667… | 81.166666666667… |
Independent interval-ledger reconstruction: **pass**; maximum tolerated rounding difference `0.000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001 kWh`. It sums the exported interval terms and ignores the engine residual fields.

## canonical-1mw-50kwh

| Measure | Independent equation | Expected | Observed |
| --- | --- | --- | --- |
| requested_it_kwh (kWh) | 1000 kW × 1800 s ÷ 3,600 | 500 | 500 |
| ride_through_s (s) | (50 kWh × 0.9 × 0.95) ÷ 1000 kW × 3,600 | 153.9 | 153.9 |
| depletion_elapsed_s (s) | 300 s outage start + ride-through | 453.9 | 453.9 |
| unserved_duration_s (s) | 900 s recovery − depletion elapsed | 446.1 | 446.1 |
| unserved_it_kwh (kWh) | 1000 kW × unserved seconds ÷ 3,600 | 123.91666666667… | 123.91666666667… |
Independent interval-ledger reconstruction: **pass**; maximum tolerated rounding difference `0.000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001 kWh`. It sums the exported interval terms and ignores the engine residual fields.

## path-maintenance-700kw

| Measure | Independent equation | Expected | Observed |
| --- | --- | --- | --- |
| requested_it_kwh (kWh) | 1000 kW × 1800 s ÷ 3,600 | 500 | 500 |
| served_kw_during_maintenance (kW) | 700 gross kW × 0.95 distribution efficiency | 665 | 665 |
| unserved_kw_during_maintenance (kW) | 1000 kW requested − served kW | 335 | 335 |
| unserved_duration_s (s) | 900 s recovery − 300 s outage start | 600 | 600 |
| unserved_it_kwh (kWh) | unserved kW × unserved seconds ÷ 3,600 | 55.833333333333… | 55.833333333333… |
Independent interval-ledger reconstruction: **pass**; maximum tolerated rounding difference `0.000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001 kWh`. It sums the exported interval terms and ignores the engine residual fields.

Receipt values show at most 14 significant digits; an ellipsis marks additional digits. The scenario/run JSON retain full numeric strings from the engine's 100-significant-digit, round-half-even context. Independent rational values are compared with a maximum absolute tolerance of `0.000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001 kWh` (also used numerically for time and power checks).
Runtime details are in `environment.json`; scenario, run, reports, and this receipt are deterministic numerical artifacts for the same inputs and engine version.
See `manifest.json` for per-file SHA-256 values; its own digest is printed by the builder.
