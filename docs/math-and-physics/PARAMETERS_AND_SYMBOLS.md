# Parameters, symbols and units

The tables below use source `d8dc3773830a397409a7a9c00a6ffed33c46fb4b`. A default is a declared synthetic choice, not a measurement. Field names are more reliable than an informal symbol when moving between model families. Do not treat two fields named “power” or “efficiency” as interchangeable without their boundary.

## Planning and shared decimal inputs

| Field / symbol | Unit and meaning | Domain / default |
| --- | --- | --- |
| `Segment.hours`, $h$ | h, duration of one planning segment | Positive; ordered segments are part of comparison identity |
| `Segment.it_load_kw`, $P_{IT}$ | kW, requested IT demand | Nonnegative; the example uses 1,000 |
| `assumed_pue`, $r$ | Ratio, assumed facility/IT power | ≥ 1; example 1.25 |
| `tariff_per_kwh`, $c$ | Scenario currency/kWh | Nonnegative known illustrative rate or explicit unknown `null` |
| `currency` | Currency label | USD, EUR or INR; no FX conversion |
| `it_capacity_kw` | kW, reporting envelope | Nonnegative; a screen rather than supply feasibility |
| Shared decimal representation | Decimal/rational quantities | No bool/nonfinite values; ≤ 128-character representation, magnitude ≤ 10¹² and ≤ 9 decimal places |

[datacenter_twin/contracts.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/contracts.py), [datacenter_twin/engine.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/engine.py), [data/scenarios/baseline-1mw.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/data/scenarios/baseline-1mw.json).

## Continuity inputs and signs

| Field / symbol | Unit / boundary | Reference preset or accepted range |
| --- | --- | --- |
| `duration_s` | s elapsed horizon | 1–86,400; reference 1,800 |
| `step_s` | s nominal interval | 1–3,600; reference 10; at most 2,000 regular intervals |
| `it_demand_kw`, $P_{requested}$ | kW at the IT boundary | Reference 1,000; explicit demand events can change it |
| Asset `capacity_kw` | kW gross network flow | Positive; reference utility 1,500, generator/battery 1,200, each path 700, load asset 2,000 |
| `it_capacity_kw` | kW reporting envelope | Reference 1,000; warning/margin, not another dispatch cap |
| `distribution_efficiency`, $\eta_d$ | IT served / gross incoming load flow | $(0,1]$; reference 0.95 |
| `battery_capacity_kwh`, $B_{max}$ | kWh stored | Reference 100; finite nonnegative domain |
| `battery_initial_kwh`, $B_0$ | kWh stored at time zero | 0 ≤ opening ≤ capacity; reference 100 |
| `battery_charge_kw`, $P_c$ | kW accepted from utility before charging loss | Reference 100 in base preset; 0 in canonical guide |
| `battery_charge_efficiency`, $\eta_c$ | Stored increment / charging input | $(0,1]$; reference 0.95 |
| `battery_discharge_efficiency`, $\eta_b$ | Delivered battery output / stored decrement | $(0,1]$; reference 0.90 |
| `generator_start_delay_s` | s after utility unavailability | Integer 0–86,400; reference 30 |
| `generator_cost_per_kwh` | Currency/kWh generated | Unknown `null` in reference case; not a fuel/ramp model |
| `Event.at_s` | Integer elapsed seconds | 0 ≤ event time < horizon; equal-time order preserved |
| $\Delta B$ / `battery_stored_change_kwh` | kWh, closing minus opening stored energy | Negative for net depletion; not a loss term |
| Grid/generator/battery powers | kW, positive supply direction | Continuity dispatch is nonnegative; contrast signed EMT source current |
| Unserved duration | s with positive IT deficit | Fractional boundary durations allowed |

[datacenter_twin/topology.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/topology.py), [datacenter_twin/demo.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/demo.py), [datacenter_twin/continuity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py). Profiles of 50 MW AI cluster, 200 MW hyperscale, 30 MW crypto and 5 MW traditional load scale synthetic electrical quantities; they do not provide compute-throughput conversion factors. The 18 presets and 24 lessons are different catalogs.

## EMT configuration

| Field | Unit | Default | Accepted interval / choices |
| --- | --- | ---: | --- |
| `source_v` | V | 800 | 400–1,000 |
| `resistance_ohm` | Ω | 0.08 | 0.02–1 |
| `inductance_mh` | mH | 0.6 | 0.1–5 |
| `capacitance_mf` | mF | 12 | 1–50 |
| `load_ohm` | Ω | 12.8 | 2–50 |
| `sag_pu` | Fraction of source voltage | 0.5 | 0.1–1 |
| `sag_start_ms` | ms | 40 | Integer 10–80 |
| `sag_duration_ms` | ms | 80 | Integer 5–100 |
| `duration_ms` | ms | 200 | Integer 200–300; sag must clear before end |
| `step_us` | μs | 20 | 5, 10, 20, 25 or 50 |

`source_a` is signed current through the series inductor; `bus_v` is signed ideal capacitor voltage. `stored_j`, `source_energy_j`, resistor/load energies and `balance_error_j` are joules. Output samples are 100 μs apart; summary extrema use integration endpoints. Half-step refinement is available for 10, 20 and 50 μs starting steps. [datacenter_twin/emt.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/emt.py), [apps/web/src/emt/engine.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/emt/engine.ts).

## Research configuration and state glossary

| Exposed field | Unit | Accepted study domain |
| --- | --- | --- |
| `load_initial_pu` | pu | 0.3–0.7 |
| `load_final_pu` | pu | 0.4–0.8 in load-step, greater than initial; comparison separately bounded to 0.5–0.6 |
| `load_pu` | pu | Study-specific bounded operating point; default 0.5 |
| `vsi_bandwidth_hz` | Hz | 60–100; default 80 in standalone SDCIB |
| `grid_reactance_pu` | pu | 0.1–0.3; default 0.19 |
| `dc_capacitance_pu` | pu | 1–3; default 2 |
| `forcing_frequency_hz` | Hz | 0.5–30; default 5 |
| `forcing_amplitude_pu` | pu | 0.01–0.05; default 0.03 |
| `load_scale` | Ratio | 0.4–0.6 in the modified nine-bus study; default 0.5 |

The exact per-study field sets/defaults are in [datacenter_twin/research/__init__.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/__init__.py) and [apps/web/src/research/types.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/research/types.ts). Configurations are not automatically portable between studies. In particular, the model-comparison VSI baseline uses 100 Hz and the hand-set startup from its own source, rather than silently adopting the standalone 80 Hz equilibrium.

| Reduced SDCIB state positions | Source names | Interpretation |
| --- | --- | --- |
| 0–2 | `theta_pll`, `eps_pll`, `vq_pll` | PLL angle, integrated filtered q-voltage, filtered q-voltage |
| 3–4 | `id_afe`, `iq_afe` | AFE dq current states |
| 5–7 | `xi_dc_afe`, `gamd_afe`, `gamq_afe` | DC-voltage and current-error integrals |
| 8 | `vdc_ups` | UPS DC-link voltage |
| 9–10 | `iU_cv`, `iV_cv` | VSI U/V converter currents |
| 11–12 | `vU_vsi`, `vV_vsi` | VSI capacitor voltages |
| 13–16 | `xiU_vsi`, `xiV_vsi`, `gamU_vsi`, `gamV_vsi` | VSI voltage/current integrals |
| 17–18 | `v_psu`, `xi_psu` | PSU voltage and voltage-error integral |
| 19–20 | `v_eq`, `xi_eq` | Equivalent-load voltage and voltage-error integral |

Electrical states are normalized to their supplied model convention; integrals carry the corresponding normalized error × seconds. Angle is in radians. `omega_b = 2π60` rad/s and `omega_s = 1` pu have distinct dimensions. `veq_ref = 0.5` is a normalized voltage reference, not an assertion of 0.5 V or a universal percentage of a physical bus. The grid network explicitly declares a 100 MVA power base; a complete SI conversion of every research state requires additional base definitions. [datacenter_twin/research/sdcib_core.py:20–43](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib_core.py#L20-L43), [datacenter_twin/research/sdcib.py:20–62](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib.py#L20-L62), [datacenter_twin/research/grid_network.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/grid_network.py).

| Numerical symbol | Meaning | Implemented convention |
| --- | --- | --- |
| $A,B,C,D$ | Local state/input/output Jacobian matrices | Finite-difference matrices about recomputed operating point |
| $\lambda$ | Eigenvalue | Real part in inverse seconds; oscillation frequency $\lvert\operatorname{Im}\lambda\rvert/(2\pi)$ Hz |
| Modal participation | Normalized magnitude from left/right vectors | Relative numerical attribution, not measured energy share |
| $Y_{eq}$ | Reduced four-port network admittance | Schur reduction of the modified test network |
| $\kappa$ | Matrix condition number | Finite and ≤ 10¹² for guarded algebraic/eigenvector operations |
| `stable` | Numerical mode flag | Re($\lambda$) ≤ 10⁻⁸; not strict asymptotic stability |
| Spectrum amplitude | Same amplitude unit as signal | Mean removed, symmetric Hann/coherent-gain corrected; not PSD |
| `duration` in `spectrum` | s between first and last sample | $dt=T/(N-1)$, not $T/N$ |

[datacenter_twin/research/sdcib.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib.py), [datacenter_twin/research/grid_network.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/grid_network.py), [datacenter_twin/spectrum.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/spectrum.py).

## Infrastructure and companion unit hazards

| Context | Correct convention | Common error to avoid |
| --- | --- | --- |
| Infrastructure line current | kVA / kV gives A after the three-phase factor | Adding an unnecessary ×1,000 |
| Transformer fault screen | Voltage in V; MVA converted by 10⁶; output A divided by 1,000 for kA | Mixing kV and V inside squared impedance base |
| Water heat balance | `thermalScreen` uses J/(kg·K) and converts kW to W | Reusing the Python helper's kJ/(kg·K) argument without conversion |
| Lumped thermal time | MW / (MJ/K) gives K/s | Reading the result as K/h |
| Optical attenuation | Length m converted to km; losses/margin in dB | Adding fiber length directly to dB/km |
| Storage sizing screen | Minutes divided by 60; efficiency and retained fractions multiply denominators | Treating nominal energy as already deliverable |
| Commissioning uncertainty | Relative independent input uncertainties | Claiming a confidence interval or correlated measurement model |
| Companion time / ratio | Minutes; IT plus simplified cooling only | Calling it the continuity engine or annual measured PUE |

The source's `screenUnits` table remains the canonical name-to-unit mapping for every screen input/output. Evidence locators carry manuscript chapter/page metadata separately from illustrative assumptions. [apps/web/src/infrastructure/screens.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/screens.ts), [docs/lesson-config.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/lesson-config.json), [datacenter_twin/calculations.py:65–72](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/calculations.py#L65-L72).

## Undefined and unknown quantities

Keep `null`/`None` and their reason fields. Zero IT energy makes period PUE undefined; zero load makes the small battery-runtime helper undefined; no active network uplink makes oversubscription undefined; nonpositive net heat has no finite rising-temperature limit time in that screen; unknown tariffs are not zero prices. Scenario/solver failures produce errors rather than invented successful outputs. [Assumptions and limits](ASSUMPTIONS_AND_LIMITS.md).
