# Worked examples and labs

These labs use the inspected source `d8dc3773830a397409a7a9c00a6ffed33c46fb4b`. All quantities are synthetic. Run from the repository root with Python 3.12+; optional scientific or browser work has additional dependencies listed in [setup](SETUP_AND_REPRODUCIBILITY.md). The observations below were recorded on **19 November 2026**, independently of historical release receipts.

## Lab 1 — Separate power, energy and assumed PUE

**Goal:** derive the schema 1 result before reading it. **Time:** about 5 minutes. **Prerequisite:** standard-library core.

```sh
python -m datacenter_twin run data/scenarios/baseline-1mw.json
```

The input specifies 1,000 kW IT demand for 8,760 hours, assumed PUE 1.25 and an illustrative USD 0.10/kWh rate. Thus IT energy is 8,760,000 kWh, facility energy is 10,950,000 kWh, non-IT energy is 2,190,000 kWh and energy-only cost is USD 1,095,000.00. These values were observed, with input SHA-256 `a47c8a0a720a79be29f25769034072440801295b91a6011f14ac99725dea87ed` and run ID `ec0f888b610cc84125cf`. [data/scenarios/baseline-1mw.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/data/scenarios/baseline-1mw.json), [datacenter_twin/engine.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/engine.py).

**Check:** calculate `1000 × 8760 × 1.25` yourself. **Interpretation:** supply continuity is not evaluated; all facility demand is assumed grid imported. Adding another cooling allowance would double-count an overhead already represented by PUE. The rate is an input assumption, not a market price.

## Lab 2 — Derive an exact depletion event

**Goal:** distinguish time from the outage from elapsed simulation time. **Time:** about 10 minutes. **Prerequisite:** standard-library core.

```sh
python -m datacenter_twin simulate --preset generator_failure
```

Utility and generator become unavailable at 300 s, with utility recovery at 900 s. For an initially full 100 kWh battery:

$$E_{IT}=100\times0.90\times0.95=85.5\ \mathrm{kWh},\qquad
\Delta t=\frac{85.5}{1000}\times3600=307.8\ \mathrm{s}.$$

Depletion occurs at **607.8 s elapsed**, leaving **292.2 s** of unserved demand before recovery. The observed run requested 500 kWh and served 418.833333… kWh; unserved energy was 81.166666… kWh. It contained 181 intervals because the exact depletion boundary splits a nominal step. Input SHA-256 was `202d1950bc8762c95216904dd9bbc890c1e1cdb51fe3f824e6e3d98f76410195`, run ID `109d4a3eabb61e4dff3d`. [datacenter_twin/demo.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/demo.py), [datacenter_twin/continuity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py).

**Check:** inspect the emitted `battery_depleted` event and reconstruct requested = served + unserved. The exact internal source/storage/loss residual is zero; independently summing finite decimal exports needs the documented serialization tolerance. **Interpretation:** this CLI preset allows charging. At full initial reserve it shares a numeric event time with the guided lesson, but not the same configuration, input digest or run ID.

## Lab 3 — Why halving reserve does not always halve ride-through

**Goal:** account for pre-outage charging. **Time:** about 10 minutes.

```sh
python -m datacenter_twin sweep --preset generator_failure --parameter battery_initial_kwh --values 0 50 100 --format markdown
```

| Opening reserve | Depletion, elapsed s | Unserved duration, s | Reason |
| ---: | ---: | ---: | --- |
| 0 kWh | 324.3675 | 575.6325 | Some energy charges before the outage |
| 50 kWh | 478.2675 | 421.7325 | Initial energy plus 300 seconds of charging |
| 100 kWh | 607.8 | 292.2 | Starts full; no pre-outage storage increase |

All three rows were observed in the recorded sweep. For the 50 kWh case, stored energy at the outage is

$$50+100\times0.95\times\frac{300}{3600}=57.916666\ldots\ \mathrm{kWh}.$$

After applying discharge and distribution efficiencies, ride-through is 178.2675 s, so elapsed depletion is 478.2675 s. The separate charging-disabled guided scenario gives **453.9 s elapsed**. Follow the existing [canonical recipe](../canonical-case.md), [sensitivity explanation](../engineering/sensitivity.md) and [notebook](../examples/battery-ride-through.ipynb) for the contrast. Changing just reserve preserves all other topology/cost inputs; it does not size real equipment. [datacenter_twin/sensitivity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/sensitivity.py), [docs/examples/battery-ride-through.ipynb](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/examples/battery-ride-through.ipynb).

## Lab 4 — Reproduce a complete evidence packet

**Goal:** retain inputs, reports and byte identities together. **Time:** about 5 minutes.

```sh
python scripts/build_evidence.py --output outputs/my-evidence --revision d8dc3773830a397409a7a9c00a6ffed33c46fb4b
python scripts/build_evidence.py --verify outputs/my-evidence
```

Choose an unused output directory. The author's fresh directory contained **14 artifacts**, passed manifest verification and current-engine numerical reproduction, and had manifest SHA-256 `9c435f005764f65fcc02d8a5a2db4b9918118fccaeb0bf3b0cee0919b894228f`. A separately named output directory can affect receipt/provenance bytes; compare the actual manifest rather than assuming every packet has this digest. Original release directories were unchanged. [scripts/build_evidence.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/build_evidence.py), [evidence method](../validation/evidence-method.md).

**Check:** verify every declared hash and the scenario-derived values. **Interpretation:** a maintainer/agent-generated packet is an inspectable software result, not independent external reproduction or facility calibration.

## Lab 5 — Inspect an ideal DC-link transient

**Goal:** relate a voltage sag, signed current and energy residual. **Time:** about 15 minutes. **Prerequisite:** standard-library core; no SciPy.

```sh
python -m datacenter_twin.emt --preset voltage-sag
```

The observed default used 800 V, 0.08 Ω, 0.6 mH, 12 mF and a 12.8 Ω load; source voltage was 0.5 pu from 40 to 120 ms. A 20 μs RK4 step produced 2,001 output rows at 100 μs spacing over 200 ms. Observed summary: initial bus 795.0310559 V; minimum bus 178.9504379 V; peak source current 1,427.080754 A; recovery peak 1,014.100921 V; balance error approximately −1.379×10⁻⁷ J. These are integration-endpoint extrema for this implementation and environment. [datacenter_twin/emt.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/emt.py), [EMT equations](../math-and-physics/EQUATIONS_AND_DERIVATIONS.md#ideal-dc-link-emt).

**Check:** derive the initial DC equilibrium `i = Vs/(R + RL)` and `v = RL × i`. In the browser, compare the completed result with Python, then use the available half-step refinement. Keep signed ideal-source energy and possible negative capacitor voltage; do not clip them to make the plot look like a protected physical converter. This circuit contains no switching semiconductor, UPS control or protective clamp.

## Lab 6 — Verify bounded infrastructure arithmetic

**Goal:** compare typed browser screens with separately written Python equations. **Time:** about 10 minutes. **Prerequisite:** Python and Node with native TypeScript stripping.

```sh
python scripts/verify_infrastructure.py
```

The observed check passed **24 cases and 222 numeric/state comparisons**, using relative tolerance `1e-11` and absolute tolerance `1e-10`. It covers **11 model families used by the 12 infrastructure lessons**. It does not independently implement all 15 `calculateScreen` model IDs: `availability`, `fuelScreen`, `conductorScreen` and `releaseGate` have separate native unit checks. [scripts/verify_infrastructure.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/verify_infrastructure.py), [apps/web/tests-engine/infrastructure.test.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/tests-engine/infrastructure.test.ts).

**Check:** for a load ledger, carry kW, kVA, kV and amperes through the line-current formula. For thermal arithmetic, note that the infrastructure water specific heat is J/(kg·K), while the small Python `steady_heat_kw` helper takes kJ/(kg·K). **Interpretation:** equation agreement validates these teaching calculations only. Engineering HOLD, missing site evidence and source-rights boundaries remain.

## Lab 7 — Inspect a research result with its diagnostics

**Goal:** distinguish numerical convergence from scientific validation. **Time:** about 20 minutes. **Prerequisite:** verified scientific dependencies.

```sh
python -m datacenter_twin.research --study modal
python -m unittest discover -s tests -p 'test_research*.py' -v
python -m unittest discover -s tests -p test_spectrum_parity.py -v
```

The author executed the existing research suite (**37 passes**) and spectrum parity suite (**2 passes**) using available NumPy 2.3.5/SciPy 1.17.0. Those versions differ from declared pins; this is supplementary execution, not locked CI reproduction. The research tests exercise all five defaults, residual recomputation, Schur feedthrough and BDF refinement, plus rejection boundaries. The CLI itself is covered by the existing research command tests. [tests/test_research.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_research.py), [tests/test_research_guards.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_research_guards.py), [tests/test_spectrum_parity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_spectrum_parity.py).

**Check:** inspect residuals, conditioning, accepted input bounds and solver metadata before reading a modal flag or chart peak. The `stable` flag uses a numerical real-part threshold; sampled transfer peaks are not continuous optimization. The spectrum is amplitude, not power spectral density. Original MATLAB files and the measured GPU trace were absent from the supplied adaptation; no run can establish equivalence to unavailable inputs. [Research derivations and limits](../math-and-physics/EQUATIONS_AND_DERIVATIONS.md#power-dynamics-and-controls).

## Record a useful lab result

Retain the exact source SHA, environment, command, exit status, original input, input hash/run ID where defined, raw output digest, expected arithmetic, observed values, units, tolerance and unresolved limitations. Exporting a chart without its applied configuration is insufficient. Keep source checks separate from later documentation, merge and deployment identities. [Verification ledger](../maintainer/VERIFICATION_EVIDENCE_LEDGER.md).
