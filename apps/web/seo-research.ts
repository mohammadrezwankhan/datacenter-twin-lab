type ResearchStudy = readonly [id: string, title: string, question: string, detail: string];

export const researchStudies: readonly ResearchStudy[] = [
  [
    'load-step',
    'Load-step response',
    'How quickly does PCC power follow a change from 0.5 to 0.6 pu?',
    'Run an equilibrated 21-state converter chain. Compare the requested load, PCC response and DC-link voltage.',
  ],
  [
    'modal',
    'Modes and frequency response',
    'What changes when the voltage-loop bandwidth changes?',
    'Inspect eigenvalues, damping, dominant state participation and a sampled small-signal frequency response.',
  ],
  [
    'forced-response',
    'Synthetic load spectrum',
    'Which part of a repeating load swing reaches the PCC?',
    'Apply a bounded sinusoidal load and compare its time response and spectrum. The input is explicitly synthetic.',
  ],
  [
    'model-comparison',
    'Phase model versus QSS',
    'What does the reduced formulation leave out?',
    'Compare the supplied 41-state abc and 21-state quasi-steady formulations, including their hand-set startup and a shared step at 0.04 s in a bounded 0.08 s window.',
  ],
  [
    'grid-network',
    'Interacting grid ports',
    'Does a solved power flow imply stable dynamics?',
    'Explore a modified nine-bus network with synchronous-machine, grid-forming, grid-following and data-center ports.',
  ],
];

export function researchPage(source: string): string {
  return `<p class="eyebrow">Advanced power dynamics / five interactive studies</p>
<h1>Follow a load change through the power system</h1>
<p class="lead">Explore converter response, oscillation modes and interacting grid ports with the supplied Python study equations running in your browser.</p>
<p><a class="button" href="../../?study=load-step">Open the study studio →</a></p>
<div class="tags"><span>Five configurable experiments</span><span>Local Python + SciPy</span><span>JSON and CSV exports</span></div>
<h2>Choose a question, predict, then run</h2><div class="cards">${researchStudies.map(([id, title, question, detail], i) => `<article class="card"><span class="eyebrow">Study ${i + 1} / 5</span><h2><a href="../../?study=${id}">${title}</a></h2><p><strong>${question}</strong></p><p>${detail}</p></article>`).join('')}</div>
<h2>Read the system at two timescales</h2>
<p>The twelve <a href="../../learn/">power-continuity lessons</a> account for energy during outages. These advanced studies investigate the dynamics of idealized converter and grid models. For an introductory electromagnetic transient, begin with the separate <a href="../emt/">DC-link RLC voltage-sag lesson</a>.</p>
<section class="panel answer"><h2>What a mode tells you</h2><p>For a linearized mode with eigenvalue λ = σ + jω, σ below zero indicates decay around that operating point. A positive σ indicates growth in the linearized model. Its frequency is |ω|/(2π) Hz; damping ratio is −σ/√(σ² + ω²). A converged power flow and stable dynamic modes answer different questions.</p></section>
<h2>Run one controlled comparison</h2><ol><li>Select the load-step study and write a prediction before running.</li><li>Keep the starting settings, run, and inspect the recorded solver diagnostics.</li><li>Change only the DC capacitance from 2 to 3 pu. Run again and compare the transient shapes.</li><li>Export each applied result. Draft input edits are not part of an earlier result.</li></ol>
<h2>Runtime and reproducibility</h2><p>The scientific runtime downloads only when you choose Run. Computation stays in a cancellable browser worker; there is no shared simulation backend or usage telemetry. The simpler course and DC-link study retain their lightweight JavaScript first calculation.</p><pre>python -m pip install -r requirements-studies.lock
python -m datacenter_twin.research --study load-step --output outputs/load-step.json</pre>
<p>Use a current checkout containing these studies. The historical v1.0.0 assets predate this addition. Results record the applied configuration, solver settings, assumptions, chart data and diagnostics. Per-unit values are normalized on the documented model bases, not automatically MW.</p>
<h2>Provenance and interpretation</h2><p>The owner supplied Python equivalents of MATLAB studies. The original MATLAB files and measured GPU trace were absent, so no MATLAB equivalence or measured-workload reproduction is claimed. The spectrum lesson uses a synthetic sinusoid. The phase-model comparison uses documented stiff integration instead of the original explicit Heun update. The nine-bus case is modified, not an unaltered standard benchmark. These are software teaching studies, not equipment or facility validation.</p>
<h2>Sources</h2><ul class="sources"><li><a href="${source}docs/studies/power-dynamics.md">Study guide, equations provenance and adaptation map</a></li><li><a href="${source}datacenter_twin/research/">Reviewed Python study implementation</a></li><li><a href="${source}tests/test_research.py">Numerical regression and residual checks</a></li><li><a href="https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html">SciPy integration methods and solver completion</a></li><li><a href="https://github.com/MATPOWER/matpower/blob/master/data/case9.m">Nine-bus test-network source and bibliography</a></li></ul>`;
}
