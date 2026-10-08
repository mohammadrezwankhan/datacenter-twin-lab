import type { LearningRecord } from './learn-manifest';

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const paths = [
  {
    id: 'continuity',
    label: 'Continuity',
    unit: 'course lessons',
    detail: 'Follow power, energy and the path to the load.',
  },
  {
    id: 'emt',
    label: 'EMT',
    unit: 'separate study',
    detail: 'Look inside a 200 ms DC-link voltage sag.',
  },
  {
    id: 'dynamics',
    label: 'Power dynamics',
    unit: 'advanced studies',
    detail: 'Explore converter response and grid modes.',
  },
] as const;

export function learningDirectory(items: LearningRecord[]): string {
  const count = (kind: string) => items.filter((item) => item.kind === kind).length;
  return `<nav class="learning-paths" aria-label="Learning pathways">${paths.map((path, index) => `<a href="#${path.id}" data-path="${path.id}" class="path-${path.id}"><span class="path-number">0${index + 1} / ${count(path.id)} ${path.unit}</span><strong>${path.label} <span aria-hidden="true">↗</span></strong><span>${path.detail}</span></a>`).join('')}</nav>
<section id="learning-library" aria-labelledby="library-title">
<div class="section-heading"><div><p class="eyebrow">Find your next question</p><h2 id="library-title">The learning library</h2></div><p>${count('continuity')} continuity lessons · ${count('emt')} EMT study · ${count('dynamics')} advanced studies.<br>Scenario presets are a separate collection.</p></div>
<form class="learn-search" role="search" aria-label="Search learning content" hidden>
<label for="learning-search">Search a topic or question<input id="learning-search" name="q" type="search" maxlength="200" placeholder="Try battery, voltage or shared controls" autocomplete="off"></label>
<fieldset><legend>Learning path</legend><div class="path-filters"><button type="button" data-filter="all" aria-pressed="true">All paths</button>${paths.map((path) => `<button type="button" data-filter="${path.id}" aria-pressed="false">${path.label}</button>`).join('')}</div></fieldset>
<div class="search-footer"><p role="status" aria-live="polite" aria-atomic="true" id="learning-count">${items.length} learning items shown</p><button type="reset">Clear filters</button></div></form>
<p class="learn-empty" hidden>No matching lessons or studies. Try a broader term, or clear the filters to see every path.</p>
${paths
  .map(
    (path) =>
      `<section id="${path.id}" class="learning-group path-${path.id}" aria-labelledby="${path.id}-title"><div class="group-heading"><h3 id="${path.id}-title">${path.label}</h3><span>${count(path.id)} ${path.unit}</span></div><div class="learning-cards">${items
        .filter((item) => item.kind === path.id)
        .map(
          (item) =>
            `<article class="learning-card" data-learning-id="${item.id}" data-kind="${item.kind}" data-search="${escape([item.title, item.question, item.description, ...item.tags].join(' ').toLowerCase())}"><span class="eyebrow">${item.kind === 'continuity' ? `Lesson ${String(item.sequence).padStart(2, '0')} / ${count('continuity')}` : item.kind === 'emt' ? 'EMT fundamentals' : `Study ${item.sequence} / ${count('dynamics')}`}</span><h4><a href="..${item.overviewPath}">${escape(item.title)}</a></h4>${item.question ? `<p>${escape(item.question)}</p>` : ''}<p class="card-description">${escape(item.description)}</p><div class="card-links"><a href="..${item.overviewPath}">${item.kind === 'continuity' ? 'Read lesson' : 'Read study guide'}<span class="sr-only">: ${escape(item.title)}</span></a><a href="..${item.runtimePath}">Run experiment<span class="sr-only">: ${escape(item.title)}</span><span aria-hidden="true"> ↗</span></a></div></article>`,
        )
        .join('')}</div></section>`,
  )
  .join('')}
<p class="small">All five power-dynamics studies share one overview; each experiment opens its own configuration. <a href="manifest.json">Learning-content manifest and source hashes</a>.</p></section>`;
}

const models = [
  {
    id: 'continuity',
    name: 'Continuity',
    title: 'Trace a path. Account for the energy.',
    nodes: ['Utility', 'Generator', 'Battery', 'Paths (aggregate)', 'IT load'],
    summary:
      'Utility, generator and finite battery supply feed distribution paths to the IT load. The path block aggregates the modeled topology; individual lessons expose parallel paths and shared failures. Availability and capacity determine what reaches the load.',
    model:
      'Power is measured in kW and energy in kWh. For the charging-disabled 1 MW example: 100 kWh × 0.90 × 0.95 ÷ 1,000 kW × 3,600 s/h = 307.8 s of ride-through. The outage starts at 300 s, so depletion occurs at 607.8 s elapsed. Lesson 12 uses a separate annual PUE ledger; it is not an outage simulation.',
    verification:
      'Compare the applied input and full result with the reference Python engine. The canonical evidence packet and lesson default/challenge records make software reproduction inspectable. Agreement between implementations does not calibrate a facility.',
    decision:
      'Use the result to explain finite reserve and failed supply paths. It does not predict GPU jobs, grid adequacy, transient voltage or certified uptime. A real facility requires equipment data and qualified engineering review.',
    overview: 'ride-through/',
    evidence: '../evidence/',
    run: '../?lesson=ride-through',
  },
  {
    id: 'emt',
    name: 'EMT',
    title: 'Stored energy changes the voltage response.',
    nodes: ['Ideal DC source', 'R + L', 'DC bus', 'Capacitor', 'Resistive load'],
    summary:
      'An ideal DC source feeds a series resistor and inductor. A capacitor and constant-resistance load share the bus. This is a DC-equivalent teaching circuit.',
    model:
      'L di/dt = Vsource − R i − Vbus; C dVbus/dt = i − Vbus/Rload. The source falls at 40 ms and recovers at 120 ms in a 200 ms study. Internal units are A, V, s, Ω, H and F. Integration steps and plotted samples are different.',
    verification:
      'Inspect the signed energy ledger, compare JavaScript with Python and halve the integration step. Analytic and step-refinement checks test the numerical implementation. They do not establish PSCAD equivalence or measured calibration.',
    decision:
      'Explain how inductance, capacitance and resistance shape a voltage sag. The ideal source may absorb reverse current, and there is no diode or voltage clamp. Converter switching, protection and an actual facility are outside this circuit.',
    overview: '../studies/emt/',
    evidence: '../studies/emt/',
    run: '../?mode=emt',
  },
  {
    id: 'dynamics',
    name: 'Power dynamics',
    title: 'Follow states, modes and interacting ports.',
    nodes: ['Load request', 'Converter states', 'PCC response', 'Linearization', 'Grid ports'],
    summary:
      'The five studies explore converter chains, small-signal modes and a modified nine-bus network. This relationship map is not a single electrical wiring diagram.',
    model:
      'For a linearized eigenvalue λ = σ + jω, frequency is |ω|/(2π) Hz and damping ratio is −σ/√(σ² + ω²). Per-unit values use the documented model bases, not an automatic conversion to MW. Converter and network formulations remain separate studies.',
    verification:
      'Read applied settings, solver completion, residuals and recorded tolerances. The owner-supplied Python studies were adapted; original MATLAB models and a measured GPU trace were absent. Historical v1.0.0 release assets predate these studies.',
    decision:
      'A converged power flow does not imply dynamic stability. A local mode does not certify a whole operating envelope. The spectrum input is synthetic, the nine-bus case is modified, and none of these studies validates equipment or controls it.',
    overview: '../studies/power-dynamics/',
    evidence: '../studies/power-dynamics/',
    run: '../?study=load-step',
  },
] as const;

function modelDiagram(model: (typeof models)[number]): string {
  const positions =
    model.id === 'continuity'
      ? [
          [75, 65],
          [75, 155],
          [75, 245],
          [270, 155],
          [455, 155],
        ]
      : model.id === 'emt'
        ? [
            [75, 155],
            [240, 65],
            [405, 65],
            [325, 190],
            [470, 190],
          ]
        : [
            [75, 75],
            [270, 75],
            [455, 75],
            [175, 235],
            [385, 235],
          ];
  const path =
    model.id === 'continuity'
      ? 'M75 65H180V155H455 M75 155H180 M75 245H180V155'
      : model.id === 'emt'
        ? 'M75 155V65H470V275H75V155 M325 65V275'
        : 'M75 75H455 M270 75V155H175V235 M270 155H385V235';
  return `<svg viewBox="0 0 540 320" role="img" aria-labelledby="diagram-${model.id}-title diagram-${model.id}-desc"><title id="diagram-${model.id}-title">${model.name}: illustrative system relationships</title><desc id="diagram-${model.id}-desc">${model.summary}</desc><path class="diagram-wire" d="${path}"/><path class="diagram-flow" d="${path}"/>${positions.map(([x, y], i) => `<g transform="translate(${x},${y})"><path class="node-depth" d="M-61,-26 L-50,-37 L72,-37 L72,15 L61,26 L-61,26Z"/><rect class="node-face" x="-61" y="-26" width="122" height="52" rx="7"/><text y="5" text-anchor="middle">${model.nodes[i]}</text></g>`).join('')}</svg>`;
}

export function learningExplorer(): string {
  return `<section class="learn-explorer" aria-labelledby="explorer-title"><div class="section-heading"><div><p class="eyebrow">From system to explanation</p><h2 id="explorer-title">See what each model can tell you</h2></div><label class="model-picker" hidden>Diagram model<select id="diagram-model">${models.map((model) => `<option value="${model.id}">${model.name}</option>`).join('')}</select></label></div>
<p class="small">Illustrative relationships, not a replay of solver results. Open a lens to reveal a reviewed explanation. Only Run experiment opens the numerical model.</p>
${models
  .map(
    (model) =>
      `<article class="model-explainer path-${model.id}" data-model="${model.id}" aria-labelledby="model-${model.id}-title"><div class="diagram-container"><p class="eyebrow">${model.name} / system view</p><h3 id="model-${model.id}-title">${model.title}</h3><div class="diagram-stage">${modelDiagram(model)}</div><p class="diagram-summary">${model.summary}</p><div class="diagram-controls" hidden><button type="button" data-view="rotate">Rotate view</button><button type="button" data-view="reset">Reset view</button><button type="button" data-flow="replay">Replay flow</button><button type="button" data-flow="pause" disabled>Pause flow</button></div><p class="flow-status small" role="status">Static diagram. No simulation is running.</p></div><div class="model-lenses"><p class="eyebrow">Four lenses / select to explore</p>${[
        ['Physical', model.summary],
        ['Model', model.model],
        ['Verification', model.verification],
        ['Decision', model.decision],
      ]
        .map(
          ([label, text], i) =>
            `<details ${i === 0 ? 'open' : ''}><summary><span class="lens-number">0${i + 1}</span> ${label}</summary><p>${text}</p>${label === 'Verification' ? `<a href="${model.evidence}">Read the guide, evidence and sources →</a>` : ''}</details>`,
        )
        .join(
          '',
        )}<div class="explorer-links"><a href="${model.overview}">Read the full guide</a><a href="${model.run}">Run experiment <span aria-hidden="true">↗</span></a></div></div></article>`,
  )
  .join('')}</section>`;
}
