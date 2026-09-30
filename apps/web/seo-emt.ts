import { DEFAULT_EMT, simulateEmt } from './src/emt/engine';

export function emtPage(source: string) {
  const result = simulateEmt(DEFAULT_EMT);
  const summary = result.summary;
  const max = Math.ceil(Math.max(...result.rows.map((r) => r.bus_v)) / 200) * 200;
  const x = (ms: number) => 52 + (ms / 200) * 650;
  const y = (v: number) => 230 - (v / max) * 190;
  const path = result.rows
    .filter((_, i) => i % 5 === 0)
    .map((r, i) => `${i ? 'L' : 'M'}${x(r.time_ms).toFixed(2)},${y(r.bus_v).toFixed(2)}`)
    .join(' ');
  const content = `<p class="eyebrow">Advanced study / EMT fundamentals</p>
<h1>Inside a voltage sag</h1><p class="lead">Explore a 200 ms DC-link transient. Change the circuit, replay the waveforms and check where the stored energy goes.</p>
<p class="byline">Original lesson by Mohammad Rezwan Khan · Circuit model dc-link-rlc-v1</p>
<p><a class="button" href="../../?mode=emt">Open the interactive EMT study →</a></p>
<section class="panel answer"><h2>The starting experiment</h2><p>An ideal 800 V DC source feeds a 0.08 Ω resistor and 0.6 mH inductor, then a 12 mF capacitor in parallel with a 12.8 Ω load. At 40 ms the source drops to 400 V. At 120 ms it returns to 800 V.</p><p>The bus starts at <strong>${summary.initial_bus_v.toFixed(2)} V</strong>, falls to <strong>${summary.minimum_bus_v.toFixed(2)} V</strong> and reaches a recovery peak of <strong>${summary.recovery_peak_v.toFixed(2)} V</strong>. Stored energy delays the response and produces ringing in this underdamped circuit.</p></section>
<figure><svg viewBox="0 0 750 290" role="img" aria-labelledby="emt-plot-title"><title id="emt-plot-title">Calculated bus voltage during a DC source sag and recovery, volts versus milliseconds</title><rect width="750" height="290" rx="12" fill="#eef4f4"/><rect x="${x(40)}" y="40" width="${x(120) - x(40)}" height="190" fill="#f5dfe5"/>${[0, 400, 800, 1200].map((v) => `<path d="M52 ${y(v)}H702" stroke="#b5c6cd"/><text x="44" y="${y(v) + 5}" text-anchor="end" font-family="system-ui" font-size="14">${v}</text>`).join('')}<path d="${path}" fill="none" stroke="#6c3bbb" stroke-width="2.5"/>${[0, 40, 80, 120, 160, 200].map((ms) => `<text x="${x(ms)}" y="254" text-anchor="middle" font-family="system-ui" font-size="14">${ms}</text>`).join('')}<text x="52" y="24" font-family="system-ui" font-size="15">Bus voltage (V)</text><text x="360" y="280" font-family="system-ui" font-size="15">Time (ms)</text></svg><figcaption>Generated from the same browser solver; shaded interval marks the source sag. The ideal source can absorb reverse current. Animation and chart samples are separate from integration steps.</figcaption></figure>
<h2>Predict, run, explain</h2><ol><li>Predict whether the capacitor voltage changes instantly when the source falls.</li><li>Run the baseline, then double capacitance. Compare both the lowest voltage and recovery peak.</li><li>Lower series resistance. Explain how reduced damping changes the waveforms.</li><li>Halve the integration step and compare every plotted voltage sample. A small difference checks numerical convergence, not equipment fidelity.</li></ol>
<h2>The equations</h2><p>Use amperes, volts, seconds, ohms, henries and farads internally:</p><pre>L di/dt = Vsource − R i − Vbus
C dVbus/dt = i − Vbus/Rload
E = ½ L i² + ½ C Vbus²
ΔE = ∫ Vsource i dt − ∫ R i² dt − ∫ Vbus²/Rload dt</pre>
<p>The initial DC state is i = 800/(0.08 + 12.8) A and Vbus = 12.8 i V. RK4 advances the electrical states and energy integrals together at 20 μs. Source events align with step boundaries. Output sampling is 100 μs; reported extrema use integration endpoints.</p>
<div class="table-wrap"><table><caption>Computed baseline energy ledger over 200 ms</caption><thead><tr><th scope="col">Quantity</th><th scope="col">Value (J)</th></tr></thead><tbody>${[
    ['Net source energy', summary.source_energy_j],
    ['Series resistor loss', summary.resistor_loss_j],
    ['Resistive load energy', summary.load_energy_j],
    ['Change in stored energy', summary.final_stored_j - summary.initial_stored_j],
    ['Numerical balance residual', summary.balance_error_j],
  ]
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${label}</th><td>${(value as number).toPrecision(9)}</td></tr>`,
    )
    .join('')}</tbody></table></div>
<h2>Reproduce the study</h2><p>From a checkout containing this lesson:</p><pre>python -m datacenter_twin.emt --preset voltage-sag --output outputs/emt.json</pre><p><a href="default-config.json">Download the ten input fields</a> · <a href="default-result.json">Download all 2,001 samples and the energy ledger</a> · <a href="${source}docs/studies/emt.md">Read the model and command guide</a>.</p>
<section class="panel"><h2>What this circuit represents</h2><p>A deliberately small electromagnetic-transient teaching circuit with an ideal DC-equivalent source, linear R-L-C elements and a constant-resistance load. It does not simulate converter switching, an AC grid, UPS controls, protection or a facility. Reverse source current and even negative capacitor voltage are allowed by the ideal equations; no diode or voltage clamp is modeled. Parameters are authored examples, with no PSCAD equivalence or measured calibration claim.</p><p>The twelve <a href="../../learn/">power-continuity lessons</a> answer different questions about outage durations, capacity and finite battery energy.</p></section>
<h2>Sources and validation</h2><ul class="sources"><li><a href="${source}datacenter_twin/emt.py">Reference Python solver</a> and <a href="${source}tests/test_emt.py">independent closed-form, energy and step-refinement tests</a>.</li><li><a href="https://www.pscad.com/webhelp/EMTDC/Introduction/introduction_to_emtdc.htm">PSCAD: introduction to time-domain electromagnetic transients</a> (background; not validation of this model).</li><li><a href="https://www.pscad.com/webhelp-v5-ol/PSCAD/Application_Project_Options/Project_Settings/Runtime.htm">PSCAD: solution timestep versus channel plot step</a>.</li><li><a href="https://www.mathworks.com/help/symbolic/solve-differential-equations-using-laplace-transform.html">MathWorks: circuit differential equations and analytic solutions</a>.</li></ul>`;
  return { content, result };
}
