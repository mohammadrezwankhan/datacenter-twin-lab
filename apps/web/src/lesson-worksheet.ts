import type { Lesson } from './course-lessons';
import { lessonValue } from './lesson-results';
import type { PlanningRun, Run } from './types';
import { worksheetStyle } from './lesson-worksheet-style';

export type LessonWorksheet = {
  lesson: Lesson;
  input: string;
  prediction: string;
  equation: { formula: string; note: string };
  calculation: Run | PlanningRun;
  sourceRevision: string | null;
};

const repository = 'https://github.com/mohammadrezwankhan/datacenter-twin-lab';
const courseUrl = 'https://khanlab.co.technology/';
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function quantity(value: unknown, unit = ''): string {
  if (value === null || value === undefined) return 'Unknown';
  const number = Number(value);
  const label = Number.isFinite(number) ? numberFormat.format(number) : String(value);
  return `${label}${unit ? ` ${unit}` : ''}`;
}

function table(caption: string, rows: [string, unknown][]): string {
  return `<table><caption>${escapeHtml(caption)}</caption><tbody>${rows
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function header(page: number, label: string): string {
  return `<header><b>DATACENTER TWIN LAB</b><span>${page} / 3 · ${label}</span></header>`;
}

function assumptions(calculation: Run | PlanningRun): [string, unknown][] {
  if (calculation.schema_version === 1) {
    const segment = calculation.assumptions.segments[0];
    return [
      ['Constant IT load', quantity(segment.it_load_kw, 'kW')],
      ['Duration', quantity(segment.hours, 'h')],
      ['Assumed PUE', quantity(segment.assumed_pue, 'ratio')],
      [
        'Grid tariff',
        quantity(calculation.assumptions.tariff_per_kwh, `${calculation.assumptions.currency}/kWh`),
      ],
      ['Energy boundary', 'IT energy plus assumed non-IT overhead; no continuity calculation'],
    ];
  }
  const scenario = calculation.scenario;
  return [
    ['IT demand / duration', `${quantity(scenario.it_demand_kw, 'kW')} / ${scenario.duration_s} s`],
    ['Nominal interval', `${scenario.step_s} s; events can split intervals`],
    [
      'Opening battery / capacity',
      `${quantity(scenario.battery_initial_kwh, 'kWh')} / ${quantity(scenario.battery_capacity_kwh, 'kWh')}`,
    ],
    ['Charging limit', quantity(scenario.battery_charge_kw, 'kW')],
    [
      'Charge / discharge efficiency',
      `${scenario.battery_charge_efficiency} / ${scenario.battery_discharge_efficiency} (ratios)`,
    ],
    ['Distribution efficiency', `${scenario.distribution_efficiency} (ratio)`],
    ['Generator startup delay', `${scenario.generator_start_delay_s} s`],
    [
      'Grid / generator tariff',
      `${quantity(scenario.tariff_per_kwh)} / ${quantity(scenario.generator_cost_per_kwh)} ${scenario.currency}/kWh`,
    ],
  ];
}

function scheduledEvents(run: Run): string {
  if (!run.scenario.events.length) return '<p>No scheduled failure or recovery events.</p>';
  return `<ul class="small">${run.scenario.events
    .map(
      (event) =>
        `<li>${event.at_s} s: ${escapeHtml(event.action.replaceAll('_', ' '))} · ` +
        `${escapeHtml(event.target)}${event.value_kw === null ? '' : ` · ${escapeHtml(event.value_kw)} kW`}</li>`,
    )
    .join('')}</ul>`;
}

function plot(run: Run | PlanningRun): string {
  if (run.schema_version === 1) {
    const values = [Number(run.it_energy_kwh), Number(run.non_it_energy_kwh)];
    const total = Number(run.facility_energy_kwh);
    const width = total > 0 ? (590 * values[0]) / total : 0;
    return `<figure><svg viewBox="0 0 640 106" role="img" aria-label="Annual energy split">
      <title>Annual IT and non-IT energy in kilowatt-hours</title>
      <rect x="25" y="16" width="${width}" height="28" fill="#176b69"/>
      <rect x="${25 + width}" y="16" width="${590 - width}" height="28" fill="#8db8d1"/>
      <text x="25" y="70" font-size="13">IT: ${quantity(values[0], 'kWh')}</text>
      <text x="25" y="93" font-size="13">Non-IT: ${quantity(values[1], 'kWh')}</text>
      </svg><figcaption>Annual energy allocation under the declared PUE assumption.</figcaption></figure>`;
  }
  const duration = run.scenario.duration_s;
  const maximum = Math.max(1, ...run.intervals.map((interval) => Number(interval.requested_it_kw)));
  const x = (seconds: string | number) => 58 + (Number(seconds) / duration) * 554;
  const y = (power: string) => 116 - (Number(power) / maximum) * 88;
  const path = (key: 'requested_it_kw' | 'served_it_kw') =>
    run.intervals
      .map(
        (interval, index) =>
          `${index ? 'L' : 'M'}${x(interval.start_s)},${y(interval[key])} ` +
          `L${x(interval.end_s)},${y(interval[key])}`,
      )
      .join(' ');
  return `<figure><svg viewBox="0 0 640 170" role="img" aria-label="Requested and served IT power">
    <title>Requested and served IT power over elapsed seconds</title>
    <path d="M58,22V116H612" fill="none" stroke="#607987"/>
    <text x="4" y="16" font-size="11">IT power (kW)</text>
    <text x="52" y="33" text-anchor="end" font-size="10">${quantity(maximum)}</text>
    <text x="48" y="120" text-anchor="end" font-size="10">0</text>
    <path d="${path('requested_it_kw')}" fill="none" stroke="#607987" stroke-width="3"/>
    <path d="${path('served_it_kw')}" fill="none" stroke="#176b69" stroke-width="2"
      stroke-dasharray="6 3"/>
    <text x="58" y="135" font-size="10">0</text>
    <text x="335" y="135" text-anchor="middle" font-size="10">${duration / 2}</text>
    <text x="612" y="135" text-anchor="end" font-size="10">${duration}</text>
    <text x="335" y="158" text-anchor="middle" font-size="11">Elapsed time (s)</text>
    </svg><figcaption>Solid: requested power. Dashed: served power. A step plot of completed
    intervals; animation and electrical transients are not represented.</figcaption></figure>`;
}

function working(lesson: Lesson, run: Run | PlanningRun): string[] {
  if (run.schema_version === 1) {
    const segment = run.assumptions.segments[0];
    return [
      `${quantity(segment.it_load_kw)} kW × ${segment.hours} h = ${quantity(run.it_energy_kwh)} kWh IT energy.`,
      `${quantity(run.it_energy_kwh)} × ${segment.assumed_pue} = ${quantity(run.facility_energy_kwh)} kWh facility energy.`,
      `Facility minus IT energy = ${quantity(run.non_it_energy_kwh)} kWh non-IT energy. Do not add continuity losses again.`,
    ];
  }
  const scenario = run.scenario;
  const result = lessonValue(lesson, run, null);
  const outage = scenario.events.find(
    (event) => event.action === 'asset_down' && event.target === 'utility',
  );
  const reserve =
    outage && run.intervals.find((interval) => Number(interval.start_s) === outage.at_s);
  const depleted = run.events.find((event) => event.action === 'battery_depleted');
  if (lesson.resultKey === 'depletion' && reserve && outage) {
    const delivered =
      Number(reserve.battery_start_kwh) *
      Number(scenario.battery_discharge_efficiency) *
      Number(scenario.distribution_efficiency);
    return [
      `At the ${outage.at_s} s outage, the stored reserve is ${quantity(reserve.battery_start_kwh)} kWh.
       The opening reserve was ${quantity(scenario.battery_initial_kwh)} kWh; charging before the outage can change it.`,
      `${quantity(reserve.battery_start_kwh)} × ${scenario.battery_discharge_efficiency} ×
       ${scenario.distribution_efficiency} = ${quantity(delivered)} kWh deliverable to the IT load in this case.`,
      `${quantity(delivered)} kWh ÷ ${quantity(scenario.it_demand_kw)} kW × 3,600 =
       ${quantity((delivered / Number(scenario.it_demand_kw)) * 3600)} s of reserve at this fixed demand.`,
      depleted
        ? `The recorded depletion is at ${depleted.at_s} s elapsed,
        ${quantity(Number(depleted.at_s) - outage.at_s)} s after the outage.`
        : 'No positive-to-zero depletion event was recorded. A battery that starts empty has no depletion transition.',
    ];
  }
  if (lesson.resultKey === 'generator_ready')
    return [
      `The outage at ${outage?.at_s ?? 'unknown'} s plus ${scenario.generator_start_delay_s} s startup delay
     gives a scheduled ready time of ${outage ? outage.at_s + scenario.generator_start_delay_s : 'unknown'} s.`,
      result === undefined
        ? 'No generator-running interval occurred. Utility recovery can precede generator service.'
        : `The first generator-running interval starts at ${result} s elapsed.`,
      `Unserved time over the completed run: ${quantity(run.summary.unserved_duration_s)} s.`,
    ];
  if (lesson.id === 'distribution-loss')
    return [
      `${quantity(scenario.it_demand_kw)} ÷ ${scenario.distribution_efficiency} =
     ${quantity(Number(scenario.it_demand_kw) / Number(scenario.distribution_efficiency))} kW required at the source.`,
      `Actual grid energy is the sum of grid kW × interval seconds ÷ 3,600:
     ${quantity(run.summary.grid_kwh)} kWh. Supply and path limits can prevent full delivery.`,
    ];
  const rules: Record<string, string> = {
    requested_it_kwh: 'Sum requested IT kW × interval seconds ÷ 3,600',
    unserved_it_kwh: 'Sum unserved IT kW × interval seconds ÷ 3,600',
    unserved_duration_s: 'Sum the duration of intervals with unserved IT demand',
    peak_unserved_kw: 'Take the largest requested-minus-served IT power across the intervals',
  };
  return [
    `${rules[lesson.resultKey] ?? 'Read the completed result'} = ${quantity(result, lesson.resultUnit)}.`,
    `The interval energy accounting residual is ${quantity(run.summary.energy_balance_residual_kwh)} kWh.
     This checks accounting consistency, not facility calibration.`,
  ];
}

function outcomeRows(run: Run | PlanningRun): [string, unknown][] {
  if (run.schema_version === 1)
    return [
      ['IT energy', quantity(run.it_energy_kwh, 'kWh')],
      ['Non-IT energy', quantity(run.non_it_energy_kwh, 'kWh')],
      ['Energy-only cost', quantity(run.energy_only_cost, run.assumptions.currency)],
    ];
  return [
    [
      'Requested / served IT energy',
      `${quantity(run.summary.requested_it_kwh)} / ${quantity(run.summary.served_it_kwh)} kWh`,
    ],
    [
      'Unserved IT energy / time',
      `${quantity(run.summary.unserved_it_kwh, 'kWh')} / ${quantity(run.summary.unserved_duration_s, 's')}`,
    ],
    ['Energy accounting residual', quantity(run.summary.energy_balance_residual_kwh, 'kWh')],
  ];
}

function topology(run: Run | PlanningRun): string {
  if (run.schema_version === 1)
    return '<p>PUE planning has no supply topology or failure events.</p>';
  return `<table><caption>Declared gross asset capacities and shared failure domains</caption>
    <thead><tr><th>Asset identifier</th><th>Capacity (kW)</th><th>Failure domains</th></tr></thead>
    <tbody>${run.scenario.assets
      .map(
        (asset) => `<tr><td>${escapeHtml(asset.id)}</td>
      <td>${escapeHtml(asset.capacity_kw)}</td><td>${escapeHtml(asset.failure_domains.join(', ') || 'None')}</td></tr>`,
      )
      .join(
        '',
      )}</tbody></table><h3>Declared connections</h3><p class="small">${run.scenario.dependencies
      .map((edge) => escapeHtml(`${edge.source} → ${edge.target} (${edge.relation})`))
      .join('; ')}</p>`;
}

export function buildLessonWorksheet(data: LessonWorksheet): string {
  const { lesson, calculation, input, prediction, equation } = data;
  const run = calculation.schema_version === 2 ? calculation : null;
  const planning = calculation.schema_version === 1 ? calculation : null;
  const result = lessonValue(lesson, run, planning);
  const absent =
    lesson.resultKey === 'generator_ready'
      ? 'No generator-running interval'
      : run?.scenario.battery_initial_kwh === '0'
        ? 'Battery starts empty'
        : 'No event in this run';
  const resultLabel =
    result === null || result === undefined ? absent : quantity(result, lesson.resultUnit);
  const estimate =
    prediction.trim() !== '' && Number.isFinite(Number(prediction))
      ? quantity(prediction, lesson.resultUnit)
      : 'Not submitted — write your estimate here';
  const revision =
    data.sourceRevision && /^[a-f0-9]{40}$/.test(data.sourceRevision) ? data.sourceRevision : null;
  const sourceLink = `${repository}/tree/${revision || 'main'}`;
  const lessonLink = `${courseUrl}?lesson=${encodeURIComponent(lesson.id)}`;
  const packet = {
    worksheet_schema_version: 1,
    lesson_id: lesson.id,
    selected_input: input,
    submitted_prediction: prediction || null,
    source_revision: revision,
    calculation,
  };
  const title = escapeHtml(lesson.title);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
    <title>${title} — lesson worksheet</title><style>${worksheetStyle}</style></head><body><main>
    <section class="sheet" id="prediction-page">${header(1, 'Prediction & exercise')}
      <p class="kicker">Power Systems for Datacenter Engineers</p><h1>${title}</h1>
      <p class="question">${escapeHtml(lesson.question)}</p>
      <p class="input"><b>${escapeHtml(lesson.label)}:</b> ${escapeHtml(quantity(input, lesson.unit))}</p>
      ${table('Inputs for this experiment', assumptions(calculation))}
      ${run ? `<h3>Scheduled events — elapsed from the start</h3>${scheduledEvents(run)}` : ''}
      <h3>Predict before checking the answer</h3>
      <p class="small">Estimate submitted with the completed run:</p>
      <p class="estimate" id="submitted-prediction">${escapeHtml(estimate)}</p>
      <p>Explain your reasoning and label the units.</p>
      <div class="write-line"></div><div class="write-line"></div><div class="write-line"></div>
      <p class="small rule">Keep the answer page separate when printing. The worksheet records an
        estimate supplied by the learner, not evidence that it was made before seeing a result.</p>
      <footer>Original teaching exercise · synthetic assumptions · ${escapeHtml(lesson.concept)}</footer>
    </section>
    <section class="sheet" id="answer-page">${header(2, 'Result & worked calculation')}
      <h2>${title}</h2><div class="result"><span>Completed result</span>
        <strong id="worksheet-result">${escapeHtml(resultLabel)}</strong></div>
      <h3>The relationship</h3><p><b>${escapeHtml(equation.formula)}</b></p>
      <p class="small">${escapeHtml(equation.note)}</p>
      <ol>${working(lesson, calculation)
        .map((step) => `<li>${escapeHtml(step)}</li>`)
        .join('')}</ol>
      ${plot(calculation)}${table('Check the completed calculation', outcomeRows(calculation))}
      <h3>Explain the difference</h3><p>Compare the result with your estimate. Which assumption
        mattered most, and what would you change next?</p><div class="write-line"></div>
      <p class="small">Display values are rounded to six decimal places. The full calculation
        retains exact engine output. “No event” is different from an event at zero seconds.</p>
      <footer>Result ${escapeHtml(calculation.run_id)} · engine ${escapeHtml(calculation.engine_version)}</footer>
    </section>
    <section class="sheet" id="evidence-page">${header(3, 'Assumptions & reproduction')}
      <h2>Keep the experiment reproducible</h2>
      <p>Open <a href="${lessonLink}">${lessonLink}</a>, set
        <b>${escapeHtml(lesson.label)} = ${escapeHtml(quantity(input, lesson.unit))}</b>, then run.
        The live site can change; use the recorded source for exact reproduction.</p>
      <p class="hash"><b>Input SHA-256</b><br><code>${escapeHtml(calculation.input_sha256)}</code></p>
      <p class="hash"><b>Source revision:</b> ${escapeHtml(revision || 'Unknown for this build')}<br>
        <a href="${sourceLink}">${sourceLink}</a></p>
      <p class="small">The input hash identifies model assumptions, not the learner's estimate
        or this document. Save the course's JSON export alongside this worksheet. The HTML file
        also contains the complete result under “Embedded calculation” below.</p>
      ${topology(calculation)}
      <p class="small"><b>Source identifiers:</b>
        ${escapeHtml((run?.scenario.source_ids ?? planning!.assumptions.source_ids).join(', '))}.</p>
      <h3>Model limits</h3><ul class="small">${calculation.limitations
        .map((limit) => `<li>${escapeHtml(limit)}</li>`)
        .join('')}</ul>
      <p class="small">Original synthetic inputs; no facility calibration, independent technical
        review, GPU-job prediction or physical controls. This worksheet is a learning record,
        not a qualification, uptime rating or safety assessment.</p>
      <footer>Datacenter Twin Lab · Apache-2.0 project material · no telemetry in this document</footer>
    </section>
    <details class="full-data"><summary>Embedded calculation (JSON; excluded from printing)</summary>
      <pre id="worksheet-evidence">${escapeHtml(JSON.stringify(packet, null, 2))}</pre></details>
    <p class="screen-only small">Print at 100% on A4 or US Letter with browser headers and footers
      off. Each section starts on a fresh page; inspect print preview before sharing.</p>
    </main></body></html>`;
}

export function downloadLessonWorksheet(data: LessonWorksheet): void {
  const url = URL.createObjectURL(
    new Blob([buildLessonWorksheet(data)], { type: 'text/html;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `lesson-${data.lesson.id}-${data.calculation.run_id}-worksheet.html`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
