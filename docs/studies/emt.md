# Inside a voltage sag: a DC-link transient study

[Open the interactive study](https://khanlab.co.technology/?mode=emt) ·
[Read the browser notes](https://khanlab.co.technology/studies/emt/)

An 800 V source falls to 400 V for 80 ms. Does the downstream bus follow it
instantly? This advanced lesson makes current, voltage and stored energy visible
over a 200 ms interval. Start with a prediction, change one circuit parameter,
run the study and explain the waveform. The twelve continuity lessons remain a
separate course about reserve energy, outage duration and supply paths.

## The experiment

The independently authored circuit is an ideal DC-equivalent source, series
resistance and inductance, then a capacitor in parallel with a resistive load.
The starting state is the DC steady state. All four presets are teaching choices.

| Input | Starting value | Allowed range |
|---|---:|---:|
| Source voltage | 800 V | 400–1,000 V |
| Series resistance | 0.08 Ω | 0.02–1 Ω |
| Series inductance | 0.6 mH | 0.1–5 mH |
| Bus capacitance | 12 mF | 1–50 mF |
| Load resistance | 12.8 Ω | 2–50 Ω |
| Source voltage during sag | 0.5 pu | 0.1–1 pu of source voltage |
| Sag start | 40 ms | 10–80 ms, whole milliseconds |
| Sag duration | 80 ms | 5–100 ms, whole milliseconds |
| Run duration | 200 ms | 200–300 ms, whole milliseconds |
| Integration step | 20 μs | 5, 10, 20, 25 or 50 μs |

The output sample interval is always 100 μs. Integration and plot sampling are
different clocks. Input bounds limit computation and keep this explicit solver
within a tested parameter box; they are not equipment specifications.

| Preset | Change from the starting case | Question |
|---|---|---|
| Voltage sag | None | Can stored energy cause a recovery overshoot? |
| Short, deep dip | 0.4 pu for 10 ms | Does a shorter event always mean less disturbance? |
| More capacitance | 24 mF | How do buffering and oscillation period change together? |
| Recovery ringing | 0.02 Ω, 4 mF | What does lower damping change? |

## Equations and numerical method

Let `i` be the series-inductor current and `v` the bus voltage. Convert mH to H,
mF to F and time to seconds before integration:

```text
L di/dt = Vsource − R i − v
C dv/dt = i − v/Rload
E = (L i² + C v²)/2
dE/dt = Vsource i − R i² − v²/Rload
```

Initially `i = Vsource/(R + Rload)` and `v = Rload i`. The source sag occupies the
half-open interval `[start, start + duration)`. Current and capacitor voltage
remain continuous at a source step. Each RK4 step uses the source value for its
own interval, so a discontinuity is not smeared into the preceding step.

The solver integrates three additional quantities at the same RK4 stages:
signed source energy, series-resistor loss and load energy. The residual is
`source − resistor loss − load energy − change in stored energy`, in joules.
Reported extrema use every integration endpoint; CSV/JSON rows use the 100 μs
output grid. Slowed animation replays those samples and has no control latency
or hardware response-time meaning.

At the starting settings the computed initial bus voltage is **795.0311 V**,
minimum bus voltage **178.9504 V**, maximum absolute source current
**1,427.0808 A**, and recovery peak **1,014.1009 V**. The model allows reverse
flow into the ideal source; large circulating currents are possible in this
underdamped circuit. It does not impose device current limits.

## Reproduce and compare

From a source checkout containing the lesson (Python 3.12 or later, standard
library only):

```sh
python -m datacenter_twin.emt --preset voltage-sag --output outputs/emt.json
python -m datacenter_twin.emt --preset buffered-bus --output outputs/emt-buffered.json
python -m unittest tests.test_emt -v
```

Choose a new output path or explicitly use `--force` to replace a result. The
historical v1.0.0 release assets predate this lesson; use the current source tree
for these commands. The existing continuity CLI remains unchanged.

For custom inputs, download the [default config](https://khanlab.co.technology/studies/emt/default-config.json),
edit its ten numerical fields, then use:

```sh
python -m datacenter_twin.emt --config emt-config.json --output outputs/emt-custom.json
```

The browser exports the entire completed result as JSON and all output samples
as CSV. Edits are drafts until **Run study** is selected. The half-step check
compares every bus-voltage output sample (20→10, 10→5 or 50→25 μs). It is a
numerical convergence observation, not a physical accuracy certificate.
Optional on-demand Python verification compares the complete schema, inputs,
assumptions, samples and summary. Its floating-point absolute tolerance is
`1e-7` in each field's stated unit. Native/browser parity is also a CI test.

Independent mathematical expectations in `tests/test_emt.py` include the DC
divider, closed-form matrix-exponential solution on both sides of the sag,
fourth-order timestep refinement and the energy identity. These checks establish
behavior of this circuit; they are not independent external equipment review.

## Interpretation and provenance

This is a small electromagnetic-transient **teaching circuit**, not a full
datacenter or switching-converter model. There is no rectifier, PWM, semiconductor
commutation, UPS controller, AC grid, protection, thermal response or GPU-job
prediction. The ideal capacitor can go negative, and the ideal source can absorb
reverse current: diode blocking and nonlinear voltage clamps are absent. Apply
real device constraints before drawing equipment conclusions.

The model, parameter choices, interface and figures are original project work.
The supplied reduced-order study informed the topic; its extracted vendor
workspace/configurations and illustrative switching ripple are not distributed
or used as numerical validation. No PSCAD/EMTDC equivalence, measured facility
calibration or independent external reproduction is claimed.

Background sources, checked 30 September 2026:

- [PSCAD: introduction to EMTDC](https://www.pscad.com/webhelp/EMTDC/Introduction/introduction_to_emtdc.htm)
  explains instantaneous time-domain electromagnetic-transient simulation.
- [PSCAD runtime settings](https://www.pscad.com/webhelp-v5-ol/PSCAD/Application_Project_Options/Project_Settings/Runtime.htm)
  distinguishes the solution timestep from the output/plot step.
- [MathWorks: solving circuit differential equations](https://www.mathworks.com/help/symbolic/solve-differential-equations-using-laplace-transform.html)
  provides background for circuit equations and analytic solutions.

These sources explain methods; they do not validate this implementation.
