# `generator_failure`

Generator failure tests finite stored energy. Utility and generator are both unavailable from 300 s to 900 s, so the battery is the only available source until it depletes.

```mermaid
flowchart LR
  U[Utility down 300–900 s] --> M[Main bus]
  G[Generator down 300–900 s] --> M
  X[Battery 100 kWh] --> M
  M --> A[Path A]
  M --> C[Path B]
  A --> L[IT load 1000 kW]
  C --> L
  X -. 607.8 s .-> Z[Battery depleted]
```

| Time | Event/state | Expected observation |
| --- | --- | --- |
| 0–300 s | Utility and generator available | IT load served; battery is full |
| 300–607.8 s | Utility and generator unavailable; battery discharging | IT load is served through the finite battery |
| 607.8–900 s | Battery empty; both generation assets unavailable | Served IT power is zero; 1,000 kW is unserved |
| 900–1,800 s | Utility and generator restored | Service returns; battery charging behavior follows the fixture |

Independent check: stored energy delivered at the IT boundary is `100 kWh × 0.90 × 0.95 = 85.5 kWh`. At 1,000 kW, ride-through duration is `85.5 kWh / 1,000 kW × 3,600 s/h = 307.8 s`. The outage starts at 300 s, so the absolute depletion event is `300 + 307.8 = 607.8 s`. Unserved duration is `900 − 607.8 = 292.2 s`, and unserved energy is `1,000 kW × 292.2/3,600 h = 81.166666... kWh`. The current run reports `served_it_kwh: "418.833333..."`, `battery_final_kwh: "23.75"`, and zero energy residual.

Run it:

```sh
python -m datacenter_twin simulate --preset generator_failure
```

The relevant regression is [`test_failure_battery_depletes_exactly_and_utility_restores_service`](../../tests/test_continuity.py); that test also checks a unity-efficiency variant, so compare its assumptions with this default preset. This is a finite-energy fixture, not a UPS runtime guarantee or facility model.
