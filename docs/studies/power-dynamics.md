# Power dynamics study studio

[Open the study studio](https://khanlab.co.technology/?study=load-step)

Move from an outage timeline to converter response, oscillation modes and
interacting grid ports. Five advanced lessons adapt the supplied Python study
equations into bounded, repeatable experiments. Each lesson has a question,
configurable inputs, numerical diagnostics, charts and a downloadable result.

The first calculation explicitly loads the local Python/NumPy/SciPy runtime
(about 31 MB in total). Nothing runs on a shared simulation server. **Cancel**
terminates the browser worker; inputs and results are not collected. The quick
continuity course and the separate [DC-link RLC study](emt.md) do not need these
scientific packages for their interactive calculations.

## Choose a study

| Lesson | Predict before running | Model and output |
|---|---|---|
| [Load-step response](https://khanlab.co.technology/?study=load-step) | Will PCC power change as quickly as the requested load? | A 21-state averaged converter chain; equilibrium, load step and bus responses. |
| [Modes and frequency response](https://khanlab.co.technology/?study=modal) | How does voltage-loop bandwidth change damping and amplification? | Jacobian eigenvalues, dominant-state participation and sampled PCC/load small-signal gain. |
| [Synthetic load spectrum](https://khanlab.co.technology/?study=forced-response) | Which part of an imposed oscillation reaches the PCC? | A bounded synthetic sinusoidal load, time response and spectrum. |
| [Full versus reduced model](https://khanlab.co.technology/?study=model-comparison) | Which features disappear when the phase model is reduced? | The supplied 41-state abc and 21-state QSS formulations under the same load step. |
| [Interacting grid ports](https://khanlab.co.technology/?study=grid-network) | Does a solved power flow also establish dynamic stability? | A modified nine-bus case with synchronous-machine, grid-forming, grid-following and data-center ports; power flow, modes and frequency response. |

**Per-unit (pu)** values are dimensionless normalized quantities on the stated
model bases. A 0.5 pu input must not be called 0.5 MW. Device defaults and the
grid case's 100 MVA base are retained with the numerical source. A grid-forming
or grid-following block here is a mathematical model, not a controller connected
to equipment.

## From the supplied scripts to interactive lessons

The owner supplied `python_equivalent.zip`, described as Python equivalents of
fourteen MATLAB files. This project preserves that conversion provenance rather
than claiming independent authorship of the supplied equations. The MATLAB
files and comparison outputs were not supplied.

| Supplied study | Browser adaptation |
|---|---|
| `SDCIB_simplified_eigs_step.py` / `sdcib_core.py` | Reviewed 21-state kernel, bounded load step and explicit equilibrium residual checks. |
| `SDCIB.py` | Modal/PCC-gain lesson with adjustable load, bandwidth, grid reactance and DC capacitance; bounded configurations replace the original large batch scans. |
| `gpu_load_response.py` | A synthetic forcing/spectrum lesson using the same reduced-model family. The missing measured trace is not replaced with invented measurements. |
| `ModelValidation.py` | Model-discrepancy lesson. The original script's explicit Heun update is replaced by documented stiff integration; its hand-set startup is not asserted to be equilibrium. The interactive window is shortened to 0–0.08 s and the original 1.025 s step is moved to 0.04 s. |
| `case9.py` and the SM/GFM/GFL/data-center port modules | Bounded power-flow/modal/frequency-response lesson. The missing-trace GPU time-domain extension is not claimed. |

The scripts' plotting, automatic CSV writes, filesystem trace paths and compiled
bytecode are not used by the browser. Charts render the returned numbers. Solver
completion and finite outputs are checked; equilibrium and network residuals
are assessed before modal results are presented. Nonconvergence is an error,
not a successful case with a warning hidden in a log.

## Interpret the calculations

- **Load steps:** compare the requested load with PCC power and DC-link signals.
  Separate the initial operating point from the response after the event.
- **Eigenvalues:** negative real parts indicate decay in the linearized model
  around that operating point. Positive real parts indicate small-signal
  instability of that model. Neither statement certifies a facility.
- **Frequency response:** plotted gain is a sampled small-signal transfer
  magnitude. The largest sampled point is not an exact resonance search.
- **Spectra:** the built-in input is synthetic. The finite record length and
  window affect spectral peaks; inspect the recorded sampling and window method.
- **Model comparison:** abc and QSS need not match. Differences show consequences
  of the respective equations, initialization and numerical settings; they do
  not establish which model matches equipment. The short startup window is a
  bounded teaching adaptation, not the original full settling-time experiment.
- **Grid ports:** a converged steady operating point and stable linear modes are
  different checks. The modified test network is not a grid-capacity assessment.

No `GPU_data.csv` was present in the archive. Therefore no real GPU workload,
absolute measured watts, performance prediction or measured-trace reproduction
is represented. No MATLAB equivalence, independent external technical review
or physical calibration is established by these software checks.

## Reproduce locally

Use a current source checkout containing these studies and Python 3.12 or later:

```sh
python -m pip install -r requirements-studies.lock
python -m datacenter_twin.research --study load-step --output outputs/load-step.json
python -m datacenter_twin.research --study modal --output outputs/modal.json
python -m unittest tests.test_research -v
```

The scientific runtime is optional; the base continuity package still has no
required third-party dependencies. Historical v1.0.0 release assets predate
these studies. Each result records the applied inputs, model, method, tolerances,
charts and diagnostics. Native and browser execution use the same reviewed
Python source with pinned NumPy 2.4.6 and SciPy 1.18.0; differential checks allow
documented numerical tolerances for different compiled runtime builds.

## Sources and attribution

- The owner-supplied Python equivalents are the source of the advanced device
  and study equations; adaptations and residual gates are project changes.
- The network uses a **modified** nine-bus data set with load scaling and a
  data-center port, not an unmodified standard case. Compare the public
  [MATPOWER case9 source](https://github.com/MATPOWER/matpower/blob/master/data/case9.m),
  which traces the test-network data to J. H. Chow (ed.), *Time-Scale Modeling of
  Dynamic Networks with Applications to Power Systems*, Springer-Verlag, 1982,
  and earlier EPRI work. MATPOWER's
  [license notice](https://github.com/MATPOWER/matpower/blob/master/LICENSE)
  distinguishes its source-code license from case data.
- [SciPy `solve_ivp`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html)
  documents stiff BDF integration and completion/error controls.
- [Pyodide package loading](https://pyodide.org/en/stable/usage/loading-packages.html)
  describes the browser scientific runtime. The deployed wheels are locally
  served and checked against the pinned runtime's SHA-256 manifest.

Background links were checked on 30 September 2026. Sources support methods and
provenance, not an equipment-validation claim.
