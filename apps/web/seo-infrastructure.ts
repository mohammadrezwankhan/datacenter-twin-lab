import { requiredPresent } from './src/required-value';
import { readFileSync, readdirSync } from 'node:fs';
import { buildScreenResult, screenUnits, type ScreenOutputs } from './src/infrastructure/screens';
import type { InfrastructureLesson } from './src/infrastructure/content';
import { courseCatalog, courseTotal } from './src/curriculum';
import { fuelEvidence, fuelInputs } from './src/infrastructure/fuel';

const content = new URL('./src/infrastructure/content/', import.meta.url);
export const infrastructureLessons = readdirSync(content)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(new URL(name, content), 'utf8')) as InfrastructureLesson);
const labels: Record<string, string> = {
  'source-statement': 'Source statement',
  'editorial-derivation': 'Editorial derivation',
  'illustrative-assumption': 'Illustrative assumption',
  unresolved: 'Unresolved',
};
const equations: Record<string, string> = {
  loadLedger:
    'IT kW = racks × rack kW × demand factor × (1 + growth); facility kW = IT kW × design ratio; residual kW = facility − IT − cooling; S(kVA) = facility kW / pf; I(A) = S(kVA)/(√3 × V(kV)).',
  capacityBank:
    'Usable unit MW = unit MW × derating × loading; available MW = (installed − unavailable) × usable unit MW; elementary N+1 count = ceil(required MW / usable unit MW) + 1.',
  transformerScreen:
    'Zbase = V²/(S × 10⁶); Ztransformer = (z%/100) × Zbase; Zsource = V²/(source MVA × 10⁶); Iload = S × 10⁶/(√3 V); Ifault = V/[√3 (Ztransformer + Zsource)]. Purely reactive, bolted three-phase screen.',
  storageScreen:
    'AC kWh = AC kW × minutes/60; delivered DC kWh = AC kWh/efficiency; nominal kWh = delivered DC kWh/(discharge fraction × retained age fraction); DC A = AC kW × 1,000/(efficiency × minimum loaded DC V).',
  inverseTime:
    'For M > 1: t(s) = 0.14 × TMS / expm1(0.02 × ln M). At M ≤ 1, no finite trip result is available in this model.',
  auxiliaryScreen:
    'THD(%) = 100 × harmonic A/fundamental A; TDD(%) = 100 × harmonic A/reference A; GPR(V) = ground A × ground Ω; DC drop(V) = 2 × DC A × one-way m × Ω/m.',
  thermalScreen:
    'Liquid kW = rack kW × capture fraction; residual air kW = rack kW − liquid kW; water kg/s = liquid kW × 1,000/(water cp × water ΔK); residual air m³/s = residual air W/(density × cp × ΔK); rise K/s = net MW/capacitance MJ/K; lumped interval s = capacitance × allowed ΔK/net MW when net MW > 0.',
  networkScreen:
    'Physical dB = length m/1,000 × dB/km + connectors × connector dB + splices × splice dB; allocation dB = physical dB + engineering margin; remaining dB = budget − allocation; ratio = downlink Gb/s / active uplink Gb/s. With zero active uplinks, the model is disconnected and ratio is unavailable.',
  facilityScreen:
    'Average kPa = mass kg × gravity m/s² / area m² / 1,000; installed thermal kW = cooling unit count × tons per unit × kW/TR. Neither is a qualified firm-capacity or point-load result.',
  commissioningScreen:
    'Restoration s = sum of declared stage s; thermal/electrical margin s = corresponding interval s − restoration s; annual IT MWh = IT MW × hours; facility MWh = IT MWh × assumed PUE; standard PUE uncertainty = PUE × sqrt(uFacility² + uIT²), assuming independence.',
  designReview:
    'Available MVA per side = (units per side − unavailable) × unit MVA; full-load A = unit MVA × 1,000/(√3 × kV); margin A = incomer A − full-load A. Capacity and current are independent necessary screens; design release remains HOLD.',
};
type PageDocument = (
  title: string,
  summary: string,
  path: string,
  content: string,
  schema: unknown,
) => string;
export async function infrastructureReadingPages(
  emit: (path: string, text: string) => void,
  document: PageDocument,
  escape: (value: unknown) => string,
  revision: string | null,
  url: (path: string) => string,
  author: Readonly<Record<string, string>>,
) {
  const table = (
    outputs: ScreenOutputs,
    units: Readonly<Record<string, string>>,
    caption: string,
  ) =>
    `<div class="table-wrap"><table><caption>${escape(caption)}</caption><thead><tr><th scope="col">Quantity</th><th scope="col">Value</th><th scope="col">Unit</th></tr></thead><tbody>${Object.entries(
      outputs,
    )
      .map(
        ([key, value]) =>
          `<tr><th scope="row">${escape(key)}</th><td>${escape(value === null ? 'Unavailable in this model' : Array.isArray(value) ? value.join(', ') : String(value))}</td><td>${escape(units[key] || '—')}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;
  for (const lesson of infrastructureLessons) {
    const starting = await buildScreenResult(lesson, lesson.experiment.defaultInputs, revision);
    const challenge = await buildScreenResult(
      lesson,
      { ...lesson.experiment.defaultInputs, ...lesson.experiment.challenge.changes },
      revision,
    );
    const fuel =
      lesson.id === 'generator-bank-fuel'
        ? await buildScreenResult(fuelEvidence(lesson), fuelInputs, revision)
        : null;
    const root = '../../../';
    const prev = courseCatalog[lesson.number - 2];
    const next = courseCatalog[lesson.number];
    const path = lesson.readingRoute;
    emit(
      `${path}results.json`,
      JSON.stringify({ starting, challenge, fuel, engineeringDecision: 'HOLD' }, null, 2) + '\n',
    );
    emit(
      `${path}index.html`,
      document(
        `${String(lesson.number)}. ${lesson.title} | Datacenter Twin Lab`,
        lesson.lead,
        path,
        `<p class="eyebrow">Infrastructure Engineering · Lesson ${String(lesson.number)} of ${String(courseTotal)} · ${String(lesson.estimatedMinutes)} minutes</p><h1>${escape(lesson.title)}</h1><p class="lead">${escape(lesson.lead)}</p><a class="button" rel="nofollow" href="${root}?lesson=${encodeURIComponent(lesson.id)}">Run this lesson interactively</a>
<aside class="panel"><h2>Engineering HOLD</h2><p>These are bounded educational screens, not an approved design or certification. Educational publication was approved by the owner on 12 October 2026; that decision does not clear engineering evidence.</p></aside>
<h2>Learning objectives</h2><ul>${lesson.objectives.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>
${lesson.sections.map((section) => `<section><p class="eyebrow">${String(labels[section.evidenceLabel])}</p><h2>${escape(section.title)}</h2><p>${escape(section.body)}</p></section>`).join('')}
<h2>Predict → run → explain</h2><ol>${lesson.experiment.instructions.map((item) => `<li>${escape(item)}</li>`).join('')}</ol><p class="equation">${escape(equations[lesson.experiment.model] || 'See the explicit model inputs and outputs.')}</p><h3>Declared starting inputs</h3><pre>${escape(JSON.stringify(starting.inputs, null, 2))}</pre>${table(starting.outputs, screenUnits(lesson.experiment.model).outputs, 'Worked default — unrounded educational outputs')}
<h2>Challenge</h2><p>${escape(lesson.experiment.challenge.question)}</p><pre>${escape(JSON.stringify(lesson.experiment.challenge.changes, null, 2))}</pre><p>${escape(lesson.experiment.challenge.answer)}</p>${table(challenge.outputs, challenge.outputUnits, 'Worked challenge')}
${fuel ? `<h2>Separate usable-fuel ledger</h2><p>Source statement: constant load and the stated source coefficient. Usable L = load kW × hours × L/kWh. Gross storage, reserve and transfer capability remain unresolved.</p><pre>${escape(JSON.stringify(fuel.inputs, null, 2))}</pre>${table(fuel.outputs, fuel.outputUnits, 'Source usable-fuel screen')}` : ''}
<h2>${escape(lesson.scene.title)} — static equivalent</h2><ol>${lesson.scene.storyboard.map((item) => `<li>${escape(item)}</li>`).join('')}</ol><p>${escape(lesson.scene.staticAlternative)}</p><p>${escape(lesson.scene.interaction)}</p><p>Narrative steps are not physical seconds. Essential states and quantities remain available without animation.</p>
<h2>Assessment and answer criteria</h2>${lesson.assessments.map((item) => `<section><h3>${escape(item.id)} · ${escape(item.question)}</h3><details><summary>Read answer and marking criterion</summary><p>${escape(item.answer)}</p><p><strong>Criterion:</strong> ${escape(item.rubric)}</p><p><strong>Source:</strong> ${escape(item.source)}</p></details></section>`).join('')}
<section class="panel"><h2>Source and model boundaries</h2><p><cite>Data Centre Infrastructure Engineering</cite>, reference manuscript revision 1 (DCIE-R1), 11 October 2026, chapter ${String(lesson.source.chapter)}, PDF pp.${lesson.source.pdfPages.join('–')}. PDF page 1 includes the cover. ${escape(lesson.source.evidenceStatus)}.</p><ul>${lesson.limits.map((item) => `<li>${escape(item)}</li>`).join('')}</ul><p>Original educational adaptation. The private PDF and missing archive are not public downloads. Source statement, Editorial derivation, Illustrative assumption and Unresolved remain distinct.</p><p>Result schema: ${starting.resultSchema}; content ${starting.contentVersion}; model ${starting.modelVersion}. <a href="results.json">Raw inputs, outputs, units, assumptions, source locators and canonical hashes</a>. No supported in-browser Python verification protocol exists for this result family.</p></section>
<nav class="jump-links" aria-label="Prerequisites">${lesson.prerequisites
          .map((id) => {
            const item = requiredPresent(
              courseCatalog.find((record) => record.id === id),
              'courseCatalog.find((record) => record.id === id)',
            );
            return `<a href="${root}${item.readingRoute}">${escape(item.title)}</a>`;
          })
          .join(
            '',
          )}</nav><nav class="pager" aria-label="Lesson navigation">${prev ? `<a href="${root}${prev.readingRoute}">Previous · ${String(prev.number)}. ${escape(prev.title)}</a>` : ''}${next ? `<a href="${root}${next.readingRoute}">Next · ${String(next.number)}. ${escape(next.title)}</a>` : `<a href="${root}studies/emt/">Continue to EMT and dynamics</a>`}</nav>`,
        {
          '@type': ['LearningResource', 'TechArticle'],
          name: lesson.title,
          author,
          url: url(path),
          learningResourceType: 'Educational lesson',
          isAccessibleForFree: true,
          inLanguage: 'en',
          version: lesson.contentVersion,
          citation: `DCIE-R1 chapter ${String(lesson.source.chapter)}, PDF pp.${lesson.source.pdfPages.join('–')}`,
        },
      ),
    );
  }
}
