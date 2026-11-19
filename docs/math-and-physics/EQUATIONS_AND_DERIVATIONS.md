# Equations and derivations

This document describes the implemented models at source `d8dc3773830a397409a7a9c00a6ffed33c46fb4b`. Equations below retain their software boundaries, signs and units. They do not convert synthetic inputs into facility validation. Use [parameters and symbols](PARAMETERS_AND_SYMBOLS.md) for accepted domains and [assumptions and limits](ASSUMPTIONS_AND_LIMITS.md) for interpretation.

## Model boundaries before arithmetic

| Model | Independent variable | Numerical method | Meaning of its result |
| --- | --- | --- | --- |
| Schema 1 planning | Ordered duration segments, hours | Decimal, 100 significant digits, half-even rounding | Demand/energy estimate using assumed PUE |
| Schema 2 continuity | Elapsed seconds and discrete events | Exact rational flow and energy accounting; finite decimal export | Served/unserved aggregate IT energy under declared availability/topology |
| Infrastructure screens | Declared scalar inputs | JavaScript finite-number algebra with guards | Bounded teaching screen with source labels and Engineering HOLD |
| DC-link EMT | Seconds internally, ms/μs in inputs/output | Fixed-step classical RK4 for two physical states and three energy ledgers | Ideal DC-equivalent transient |
| Power-dynamics research | Seconds, normalized states and local perturbations | Equilibrium solve, finite-difference linearization, modal analysis and BDF where applicable | Numerical behavior of the supplied/adapted reduced equations |
| Offline companion | Minutes | Closed-form `cooling` proxy evaluated independently at each sample | Synthetic utilization/cooling illustration |

Implementations: [datacenter_twin/engine.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/engine.py), [datacenter_twin/continuity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py), [apps/web/src/infrastructure/screens.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/screens.ts), [datacenter_twin/emt.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/emt.py), [datacenter_twin/research/sdcib.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib.py), [docs/index.html:254–346](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/index.html#L254-L346).

## Schema 1: assumed-PUE planning

For segment $j$, let $P_{IT,j}$ be kW, $h_j$ hours and $r_j$ the assumed dimensionless PUE:

$$P_{facility,j}=r_jP_{IT,j},\quad E_{IT,j}=P_{IT,j}h_j,\quad
E_{facility,j}=r_jP_{IT,j}h_j.$$

Sum energy over segments. Non-IT energy is $E_{facility}-E_{IT}$; period PUE is $E_{facility}/E_{IT}$ when IT energy is positive, otherwise `null` with a reason. Peak IT demand and its margin against `it_capacity_kw` are screens, not electrical dispatch. All facility energy is assumed grid imported. [datacenter_twin/engine.py:11–91](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/engine.py#L11-L91).

For a known illustrative tariff $c$ in currency/kWh, energy-only cost is $cE_{facility}$ rounded to 0.01 with half-even rounding. Unknown tariff remains `null`. Comparison uses **baseline minus alternative**, requires equal currency and identical ordered `(hours, it_load_kw)` pairs, and does not infer exchange rates or comparable work from different demand profiles. [datacenter_twin/engine.py:94–126](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/engine.py#L94-L126).

The smaller arithmetic helpers separately compute node-hour cost $Hc$, provisioned GPU-hour rate $c/n$, and token cost $(N_{in}c_{in}+N_{out}c_{out})/10^6$. They normalize declared billing units, not throughput equivalence. `battery_runtime_hours` divides already-deliverable kWh by kW and returns `None` for zero load. `steady_heat_kw` uses $\dot m c_p\Delta T$ with **$c_p$ in kJ/(kg·K)**, producing kW. [datacenter_twin/calculations.py:16–72](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/calculations.py#L16-L72), [datacenter_twin/catalog.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/catalog.py).

## Schema 2: event-driven electrical continuity

### Topology and dispatch

The contract contains one utility, generator, battery and aggregate IT load, with optional buses/distribution assets. `feeds` and `requires` graphs are acyclic; an explicit bus-to-battery `charges` edge defines charging reachability. The solver splits nodes to impose their gross power capacities and uses deterministic breadth-first residual-network augmentation. Source priority is utility, then generator, then battery; residual rerouting can reallocate earlier paths while respecting capacities. This is a max-flow model, not impedance-based AC load sharing. [datacenter_twin/topology.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/topology.py), [datacenter_twin/continuity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py).

Let $P_{gross}$ be flow arriving at the load before distribution losses and $\eta_d$ distribution efficiency. The served IT power is

$$P_{served}=\eta_dP_{gross},\qquad P_{unserved}=P_{requested}-P_{served}.$$

All node/path caps, including the load asset's `capacity_kw`, apply on the **gross pre-distribution side**. `it_capacity_kw` separately creates a margin/warning and does **not** add another dispatch cap. A 700 kW surviving distribution path at $\eta_d=0.95$ can deliver 665 kW at the IT boundary. [datacenter_twin/continuity.py:337–364](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py#L337-L364), [datacenter_twin/continuity.py:522–548](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py#L522-L548), [datacenter_twin/continuity.py:579–580](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py#L579-L580), [datacenter_twin/continuity.py:669–670](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py#L669-L670).

### Event order and exact boundaries

External events at the same second retain their input order. Generator startup is triggered by utility-asset unavailability; a downstream path failure alone does not start it. Availability restoration or generator unavailability resets the corresponding readiness behavior. Charging uses spare utility only, with the required assets and charge path available; the solver does not charge while discharging or from generator dispatch. [datacenter_twin/continuity.py:308–364](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py#L308-L364).

For each iteration the interval end is the earliest of the next regular step, external event, generator-ready time, exact empty/full battery boundary and horizon. Consequently, the output interval count may exceed the nominal regular-step count. The separate runtime guard is evaluated in the implementation; it is not a promise of exactly 5,000 possible rows. A 10-second input step therefore does not quantize depletion to a 10-second grid. [datacenter_twin/continuity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py).

### Battery state and energy conservation

Let $\Delta h=\Delta t/3600$, charge power $P_c\ge0$, delivered battery power $P_b\ge0$, charging efficiency $\eta_c$, discharge efficiency $\eta_b$, and stored energy $B$ in kWh:

$$\Delta B=\eta_cP_c\Delta h-\frac{P_b\Delta h}{\eta_b}.$$

The conversion losses in that interval are

$$L_c=P_c\Delta h(1-\eta_c),\quad
L_b=P_b\Delta h\left(\frac1{\eta_b}-1\right),\quad
L_d=(P_{gross}-P_{served})\Delta h.$$

With grid energy including utility energy used for charging, the exact invariant is

$$E_{grid}+E_{generator}-\Delta B-E_{served}-L_c-L_b-L_d=0.$$

Also $E_{requested}=E_{served}+E_{unserved}$. Opening stored energy is an initial state; it is not charged again as current-period grid/generator energy. Unknown energy rates propagate to cost when positive energy requires that rate; zero generator energy can have zero cost even when its rate is unknown. [datacenter_twin/continuity.py:522–548](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py#L522-L548), [datacenter_twin/continuity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py).

The engine checks this identity using `Fraction` **before** formatting with a 100-digit Decimal context. Exported `energy_balance_residual_kwh: "0"` describes that internal invariant, not an independent measurement. The evidence builder independently reconstructs the ledger from exported decimal terms and allows absolute $10^{-90}$ in the displayed unit for serialization rounding; it does not read the residual field to decide that reconstruction passes. [docs/validation/evidence-method.md:3–21](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/validation/evidence-method.md#L3-L21), [scripts/build_evidence.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/build_evidence.py).

### A hand-checkable battery example

For 100 kWh opening energy, $\eta_b=0.90$, $\eta_d=0.95$ and 1,000 kW IT demand with no other source:

$$E_{deliverable}=100(0.90)(0.95)=85.5\ \mathrm{kWh},\qquad
t_{ride}=\frac{85.5}{1000}(3600)=307.8\ \mathrm{s}.$$

The outage starts at elapsed 300 s, so depletion is at 607.8 s. At 50 kWh with charging disabled, ride-through is 153.9 s and depletion 453.9 s. The CLI preset's enabled 100 kW charging adds $100(0.95)(300/3600)=7.916666\ldots$ kWh before the outage, giving 478.2675 s elapsed for that separate 50 kWh case. The guided scenario and CLI preset therefore have different metadata and hashes even when the full-reserve event time matches. [docs/canonical-case.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/canonical-case.md), [docs/examples/battery-ride-through.ipynb](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/examples/battery-ride-through.ipynb), [observed labs](../developer/WORKED_EXAMPLES_AND_LABS.md).

## Infrastructure screens

These equations are separate from continuity dispatch. Inputs/results carry units and evidence labels; numeric results are guarded against nonfinite intermediates. A positive capacity margin is an algebraic screen and does not remove Engineering HOLD. The implementation exposes 15 model IDs. [apps/web/src/infrastructure/screens.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/screens.ts).

| Model | Implemented relation and units | Interpretation boundary |
| --- | --- | --- |
| `loadLedger` | $P_{IT}=N_{rack}P_{rack}f_d(1+g)$; $P_f=P_{IT}r$; $S=P_f/pf$; $I=S/(\sqrt3V_{kV})$ for S in kVA | Design-point ratio $r$ is assumed, not automatically annual measured PUE; residual overhead is facility minus IT minus declared cooling |
| `capacityBank` | $C_u=C_{unit}d\ell$; $C_{available}=(n-n_{unavailable})C_u$; $n_{N+1}=\lceil P/C_u\rceil+1$ | Uses a bounded eight-epsilon floating comparison tolerance, not an engineering contingency margin |
| `availability` | $q=MTTR/(MTBF+MTTR)$; independent pair $q^2$; combined $q_s+(1-q_s)q^2$; annual minutes $8760\times60\,q_{combined}$ | Assumed independence/common contribution; not calibrated reliability or continuity simulation |
| `transformerScreen` | $Z_b=V^2/(S_{MVA}10^6)$; $Z_t=z_\%Z_b/100$; $Z_s=V^2/(S_{source,MVA}10^6)$; $I_{kA}=V/[\sqrt3(Z_t+Z_s)1000]$ | Simplified balanced scalar screen; `null` source MVA means the modeled infinite bus |
| `fuelScreen` | Volume L = load kW × hours × L/kWh | Constant assumed consumption; no generator dynamics or equipment selection |
| `storageScreen` | $E_{AC}=P_{AC}t_{min}/60$; $E_{DC}=E_{AC}/\eta$; $E_{nom}=E_{DC}/(f_{discharge}f_{retained})$; $I_{DC}=1000P_{AC}/(\eta V_{min})$ | Declared efficiency/retention factors, not a calibrated battery-aging curve |
| `inverseTime` | $t=0.14\,TMS/[M^{0.02}-1]$, implemented with `expm1(0.02 log(M))`; $M\le1$ gives no trip time | Curve illustration, not a relay-setting instruction or coordination proof |
| `conductorScreen` | $S=I\sqrt t/k$ in the declared A, s and material coefficient units | Simplified adiabatic screen, not installation compliance |
| `auxiliaryScreen` | THD = $100I_h/I_1$; TDD = $100I_h/I_{ref}$; GPR = $I_gR_g$; DC drop = $2IL_{one-way}r$ | Scalar arithmetic; no waveform, grounding-grid or harmonic study |
| `thermalScreen` | Net MW = heat − removal; liquid/air split from rack kW and capture fraction; $\dot m=1000P_{liquid,kW}/(c_{p,J/kgK}\Delta T)$; airflow = $1000P_{air,kW}/(\rho c_p\Delta T)$ | Water/air properties are declared constants; no CFD or control loop |
| `thermalScreen` transient | $dT/dt=Q_{net,MW}/C_{MJ/K}$; time to limit = $C\Delta T/Q_{net}$ when net heat is positive, otherwise `null` | Lumped constant heat-capacity slope, not a time-varying thermal simulation |
| `networkScreen` | Optical loss = length km × dB/km + connector + splice loss; margin = budget − loss − chosen margin; active uplink = surviving uplinks × rate | Oversubscription ratio is downlink aggregate / active uplink; disconnected ratio is `null`; no traffic queue/latency model |
| `facilityScreen` | Average pressure = $mg/(1000A)$ kPa; cooling capacity = units × tons/unit × kW/ton | Average load/capacity calculation, not structural or plant verification |
| `commissioningScreen` | Restore time is the sum of declared stages; electrical/thermal margin = limit − restore; IT MWh = MW × h; facility MWh = IT × PUE | First-order uncertainty uses $u_{PUE}=PUE\sqrt{u_f^2+u_{IT}^2}$ for independent relative input uncertainties |
| `designReview` | Per-side required load compared with available unit capacity, including one-unit-out screen | Structured review of numeric assumptions, not a certification decision |
| `releaseGate` | Six explicit states; any `fail` or `unresolved` gives HOLD; all `pass` gives `teaching-screens-satisfied` | `certification` remains false; direct string-state interface differs from the numeric `buildScreenResult` wrapper |

The existing Python verifier compares 24 cases/222 values and states across 11 model families, at `rel_tol=1e-11`, `abs_tol=1e-10`. Other models have native unit tests. That scoped result must not become a claim that every screen has a separate independent Python implementation. [scripts/verify_infrastructure.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/verify_infrastructure.py), [apps/web/tests-engine/infrastructure.test.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/tests-engine/infrastructure.test.ts).

## Ideal DC-link EMT

The ideal source $V_s$ feeds series $R,L$ and parallel $C,R_L$. States are source current $i$ and bus voltage $v$:

$$\frac{di}{dt}=\frac{V_s-Ri-v}{L},\qquad
\frac{dv}{dt}=\frac{i-v/R_L}{C}.$$

Initial conditions are the pre-sag DC equilibrium $i_0=V_s/(R+R_L)$ and $v_0=R_Li_0$. mH and mF inputs are multiplied by $10^{-3}$; integration uses seconds. During the source sag $V_s$ is multiplied by `sag_pu`, then restored. [datacenter_twin/emt.py:49–59](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/emt.py#L49-L59), [datacenter_twin/emt.py:121–185](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/emt.py#L121-L185).

Stored energy is $W=Li^2/2+Cv^2/2$. Three additional integrated states accumulate source energy, resistor loss and load energy:

$$\dot E_s=V_si,\qquad\dot E_R=Ri^2,\qquad\dot E_L=v^2/R_L.$$

The numerical residual is $E_s-E_R-E_L-(W-W_0)$. Classical RK4 advances all **five** states together. The left-interval source value is held at each of the four stages; output at the event boundary uses the right-continuous source. Output spacing is 100 μs, and extrema are evaluated at integration endpoints. They are not analytically optimized continuous-time maxima. Signed $E_s$ allows reverse energy into the ideal source; negative capacitor voltage is permitted by this ideal system. [datacenter_twin/emt.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/emt.py), [apps/web/src/emt/engine.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/emt/engine.ts).

Python/native comparison checks complete structure and numeric absolute differences up to `1e-7`. Native refinement accepts supported half-step pairs from 10, 20 or 50 μs; the existing tests separately check no-sag invariants and a smaller sampled voltage difference on refinement. Those software tolerances are not a physical error budget. [apps/web/tests-engine/emt.test.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/tests-engine/emt.test.ts), [tests/test_emt.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_emt.py).

## Power dynamics and controls

### Provenance and state interpretation

Research equations are adapted from an owner-supplied Python-equivalent archive, SHA-256 `c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab`. Original MATLAB files and the measured GPU trace were not supplied. The wrapper therefore establishes neither MATLAB equivalence nor measured-profile validation. [datacenter_twin/research/sdcib_core.py:1–4](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib_core.py#L1-L4), [datacenter_twin/research/grid_network.py:1–8](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/grid_network.py#L1-L8).

The reduced SDCIB model has 21 states, ordered as PLL angle/integral/filtered quadrature voltage; AFE d/q currents, DC-voltage integral and d/q current integrals; UPS DC voltage; VSI U/V currents, U/V capacitor voltages, voltage integrals and current integrals; PSU voltage/integral; and equivalent-load voltage/integral. `STATE_NAMES` is authoritative. Electrical variables are normalized; time is seconds and $\omega_b=2\pi(60)$ rad/s, while nominal synchronous speed is 1 pu. Do not relabel every normalized voltage/current as SI V/A without a defined base. [datacenter_twin/research/sdcib_core.py:20–43](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib_core.py#L20-L43), [datacenter_twin/research/sdcib.py:20–62](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib.py#L20-L62).

### Implemented controller structure

For bandwidth $f_{bw}$, $\omega_n=2\pi f_{bw}$. The helper tunes voltage PI gains as $K_p=2\zeta\omega_n C/\omega_b$, $K_i=\omega_n^2 C/\omega_b$. Current PI uses $L$ in place of $C$ and subtracts resistance from $K_p$. PLL gains are $2\zeta\omega_n/\omega_b$ and $\omega_n^2/\omega_b$. These are the implementation's normalized-loop conventions. [datacenter_twin/research/common.py:45–68](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/common.py#L45-L68).

Representative coupled equations show how those loops enter the model:

$$\omega_{PLL}=\omega_s+K_{p,PLL}v_{q,f}+K_{i,PLL}\epsilon,\quad
\dot\theta=\omega_b(\omega_{PLL}-\omega_s),\quad
\dot\epsilon=v_{q,f},\quad\dot v_{q,f}=\omega_{lp}(v_q-v_{q,f}).$$

$$\dot i_d=\frac{\omega_b}{L_a}(v_d-m_dv_{dc}-R_ai_d+\omega_{PLL}L_ai_q),\quad
\dot i_q=\frac{\omega_b}{L_a}(v_q-m_qv_{dc}-R_ai_q-\omega_{PLL}L_ai_d).$$

$$\dot v_{dc}=\frac{\omega_b}{C_{dc}}(m_di_d+m_qi_q-m_Ui_U-m_Vi_V).$$

The VSI U/V current and capacitor-voltage equations include their matching rotation cross terms. The PSU and equivalent-load controls use $g_{load}=p_{load}/(3v_{eq,ref}^2)$, $i_{eq}=K_p(v_{eq,ref}-v_{eq})+K_i\xi_{eq}$ and the implemented guarded conversion between PSU and load voltages. The final load equation is $\dot v_{eq}=\omega_b(i_{eq}-g_{load}v_{eq})/C_{eq}$. AFE current-integral errors use `actual − reference`, whereas VSI current-integral errors use `reference − actual`; transcribing every controller with one assumed sign would change the implemented system. All 21 derivative assignments and algebraic output definitions are in [datacenter_twin/research/sdcib_core.py:118–198](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib_core.py#L118-L198).

`safe_div` preserves the denominator sign while flooring its magnitude at $10^{-9}$. Other specific voltage denominators use positive floors; the grid-port implementation also has $10^{-6}$ guards. These are numerical regularizations with different contexts, not a universal physical diode or voltage clamp. [datacenter_twin/research/common.py:21–26](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/common.py#L21-L26), [datacenter_twin/research/datacenter_port_model.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/datacenter_port_model.py), [datacenter_twin/research/sdcib_core.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib_core.py).

### Equilibria, linearization and time integration

The standalone wrapper solves $f(x,u)=0$ with a finite-difference Newton method (up to 80 iterations, residual/step targets $10^{-10}$, least-squares fallback and backtracking), then independently recomputes its residual. A SciPy root fallback can be used; accepted equilibrium infinity norm must be below $10^{-6}$. A step-size stopping condition alone is not accepted as proof of equilibrium. State Jacobian increments are $10^{-7}(1+|x_i|)$; the input perturbation uses $10^{-6}(1+|u|)$. [datacenter_twin/research/sdcib_core.py:46–85](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib_core.py#L46-L85), [datacenter_twin/research/sdcib.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib.py), [datacenter_twin/research/common.py:29–42](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/common.py#L29-L42).

The load-step study changes command at 0.2 s over a 1 s/201-sample interval. Forced response runs a synthetic sinusoidal command for 2 s with 801 samples. The BDF wrapper uses `rtol=1e-6`, `atol=1e-8`, and an ordinary maximum step of 0.002 s; forced response also bounds it by $1/(20f)$. It rejects failed, incomplete or nonfinite solver output. SciPy documents BDF as an implicit variable-order method; its successful termination is numerical evidence, not proof of the physical model. [datacenter_twin/research/sdcib.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib.py), [SciPy solve_ivp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html).

For the local linearization,

$$\delta\dot x=A\delta x+B\delta u,\qquad
\delta y=C\delta x+D\delta u,\qquad
H(j2\pi f)=C(j2\pi fI-A)^{-1}B+D.$$

Modal eigenvectors require finite condition number ≤ $10^{12}$ and left/right residuals within $10^{-5}\max(1,\|A\|_\infty)$. Participation uses normalized magnitudes of right vectors times conjugated left vectors. The `stable` field uses **Re($\lambda$) ≤ $10^{-8}$**, a numerical threshold that includes neutral/slightly positive values; it is not strict mathematical asymptotic stability. Transfer peaks are selected from **160 logarithmic samples from 0.1 to 1,000 Hz**, not a continuous peak search. [datacenter_twin/research/sdcib.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib.py), [datacenter_twin/research/grid_network.py:454–482](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/grid_network.py#L454-L482).

### Amplitude spectrum, including odd records

For $N\ge3$ real finite samples whose endpoint span is $T$, the implementation sets $\Delta t=T/(N-1)$, removes the mean and applies a **symmetric Hann** window $w_n$. With $X=\operatorname{rfft}((x-\bar x)w)$:

$$A_k=\frac{|X_k|}{N\operatorname{mean}(w)}.$$

Positive-frequency amplitudes are doubled except the even-length Nyquist bin; the final bin of an odd-length record is doubled because it is still a positive-frequency bin with a negative-frequency partner. This is a coherent-gain-normalized **amplitude spectrum**, not PSD or energy per Hz. An 801-point, 2-second record has sampling frequency 400 Hz and final bin about 199.7503 Hz, not a 200 Hz Nyquist sample. [datacenter_twin/spectrum.py:26–39](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/spectrum.py#L26-L39), [NumPy rfft reference](https://numpy.org/doc/stable/reference/generated/numpy.fft.rfft.html).

The parity tests compare independent DFTs for 800- and 801-point records at `rtol=1e-10`, `atol=3e-14`. A sampled output-spectrum peak need not equal the synthetic forcing frequency exactly. [tests/test_spectrum_parity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_spectrum_parity.py), [tests/test_research.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_research.py).

### Phase-model comparison and grid network

The model comparison stacks **41 abc states and 21 reduced U/V states**, with no cross-coupling between the two blocks. It retains the supplied hand-set startup, not an equilibrium initial condition. The supplied 1.025 s load event is retimed to **0.04 s in a 0.08 s teaching window**, with 221 reported samples. Two BDF intervals use `rtol=1e-8`, `atol=1e-10` and a block Jacobian; this is not the imported 5 μs Heun experiment. The abc model includes smoothing, duty bounds and anti-windup behavior absent from the reduced model, so output RMS difference compares representations rather than measuring physical error. The exposed final-load range is deliberately bounded to the tested study domain. [datacenter_twin/research/model_comparison.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/model_comparison.py), [datacenter_twin/research/model_validation.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/model_validation.py), [tests/test_research.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_research.py).

The modified nine-bus grid uses a **100 MVA base**, power-flow initialization, four complex port voltages and SM/GFM/GFL/DC device models. Its 9 + 13 + 15 + 21 = **58 dynamic states** become **57** after removing the synchronous-machine angle reference. It is not a measured-GPU-profile time simulation. The upstream [MATPOWER case9 source](https://github.com/MATPOWER/matpower/blob/master/data/case9.m) is context for the test-network family; the repository's parameterization is a variant, not an assertion of identity with that moving upstream file. [datacenter_twin/research/grid_network.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/grid_network.py), [datacenter_twin/research/sm_port_model.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sm_port_model.py), [datacenter_twin/research/gfm_port_model.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/gfm_port_model.py), [datacenter_twin/research/gfl_port_model.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/gfl_port_model.py), [datacenter_twin/research/datacenter_port_model.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/datacenter_port_model.py).

Network reduction first forms $Y_{eq}=Y_{pp}-Y_{pl}Y_{ll}^{-1}Y_{lp}$. For linearized differential/algebraic blocks

$$\delta\dot x=A\delta x+B\delta v+E\delta u,\qquad
0=C\delta x+D\delta v+E_a\delta u,$$

the code forms $A_{eff}=A-BD^{-1}C$, $B_{eff}=E-BD^{-1}E_a$, $C_{eff}=-HD^{-1}C$ and $D_{eff}=-HD^{-1}E_a$, then removes the same angle coordinate from the corresponding matrices. The algebraic Jacobian must have condition number ≤ $10^{12}$; a recomputed perturbed algebraic solution checks direct feedthrough with relative error ≤ $10^{-4}$. Generator/converter injections are positive into the network; the consuming DC port uses the opposite injection sign and displayed load power is converted consistently. [datacenter_twin/research/grid_network.py:373–453](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/grid_network.py#L373-L453).

## Offline companion: the active cooling proxy

The four-module HTML companion selects `model.kind = "cooling"`. Time $t$ is minutes, $N$ server count, $U$ assumed utilization percent, $T_a$ ambient °C and COP constant:

$$u(t)=\operatorname{clamp}(U+8\sin(t/8)+3\cos(t/3),0,100),$$
$$P_{IT}=N(0.12+0.38u/100)\ \mathrm{kW},\quad
P_c=\frac{P_{IT}}{COP}[1+0.025\max(T_a-20,0)],\quad
r=1+P_c/P_{IT}.$$

Its inlet proxy is $22+(T_a-22)e^{-t/15}+[4P_{IT}/(N\,COP)](1-e^{-t/15})$. It is a heuristic relaxation with a synthetic utilization wave, not a calibrated thermal state solver. The displayed ratio includes only this modeled cooling overhead. Parameters/time are clamped by this companion evaluator; that behavior differs from the research/EMT draft validators that reject out-of-domain inputs. [docs/index.html:242–288](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/index.html#L242-L288), [docs/lesson-config.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/lesson-config.json).

The shared inline evaluator also contains `battery`, `thermal`, `degradation`, `grid`, `agents`, `markets`, `control`, `security` and `charging` branches. Their source dispatch is accounted for, but they are not the selected datacenter companion curriculum or alternate implementations of the native continuity engine. In order, they use coulomb counting with a heuristic voltage/temperature model; first-order thermal relaxation; exponential fade; synthetic solar/demand arithmetic; aggregate queue capacity; synthetic spread/cost arithmetic; an analytical second-order step response; aggregate alert capacity; and piecewise constant/tapered charging. These code paths and their declared `MODEL_SPECS` remain unchanged; no new execution or physical-validation claim is attached to them. [docs/index.html:259–346](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/index.html#L259-L346).

## What the verification establishes

Exact ledgers, independent hand arithmetic, differential Python/native tests, finite-value guards, residual recomputation and step refinement address different software risks. None establishes measured facility accuracy, equipment suitability, source-manuscript approval beyond recorded rights, or external scientific review. Read [the dated ledger](../maintainer/VERIFICATION_EVIDENCE_LEDGER.md) for the actually executed commands, dependency differences and historical CI evidence.
