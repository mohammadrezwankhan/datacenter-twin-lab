import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, CSSProperties } from 'react';
import { researchRequest } from './runtime-client';
import { ModePlot } from './ModePlot';
import { ResearchDiagram } from './NetworkDiagram';
import { ResearchChart } from './ResearchChart';
import { initialConfig, isResearchStudyId, RESEARCH_STUDIES } from './types';
import type { ResearchResult, ResearchStudy, ResearchStudyId } from './types';
import './research.css';

type NumericDraft = Record<string, string>;
type RunError = { title: string; detail: string };

function configDraft(study: ResearchStudy, source?: Record<string, number>): NumericDraft {
  return Object.fromEntries(
    study.fields.map((field) => [field.name, String(source?.[field.name] ?? field.initial)]),
  );
}

function parseConfig(study: ResearchStudy, draft: NumericDraft) {
  const config: Record<string, number> = {};
  for (const field of study.fields) {
    const raw = draft[field.name] ?? '';
    if (!raw.trim())
      return { error: `Enter a value for ${field.label}. Values are not adjusted automatically.` };
    const value = Number(raw);
    if (!Number.isFinite(value)) return { error: `${field.label} must be a finite number.` };
    if (value < field.min || value > field.max)
      return {
        error: `${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`,
      };
    config[field.name] = value;
  }
  return { config };
}

function sameConfig(
  first: Record<string, number> | undefined,
  second: Record<string, number> | undefined,
) {
  if (!first || !second) return false;
  const a = Object.keys(first).sort();
  return a.every((key) => first[key] === second[key]);
}

function numeric(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not reported';
  const formatted =
    value !== 0 && (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e7)
      ? value.toExponential(3)
      : new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function cleanFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'result'
  );
}

function save(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function csvResult(result: ResearchResult) {
  const cells = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = [['chart_id', 'chart_title', 'x_label', 'x', 'line_label', 'y_label', 'y']];
  for (const chart of result.charts) {
    const length = Math.min(chart.x.length, ...chart.lines.map((line) => line.values.length));
    for (let index = 0; index < length; index++) {
      for (const line of chart.lines) {
        rows.push([
          chart.id,
          chart.title,
          chart.x_label,
          String(chart.x[index]),
          line.label,
          chart.y_label,
          String(line.values[index]),
        ]);
      }
    }
  }
  return rows.map((row) => row.map(cells).join(',')).join('\r\n') + '\r\n';
}

function configLabel(study: ResearchStudy, config: Record<string, number>) {
  return study.fields
    .map((field) => `${field.label}: ${numeric(config[field.name], field.unit)}`)
    .join(' · ');
}

function chartRanges(result: ResearchResult) {
  return result.charts.slice(0, 3).flatMap((chart) =>
    chart.lines.map((line) => {
      const values = line.values.filter(Number.isFinite);
      if (!values.length) return `${chart.title} · ${line.label}: no finite samples`;
      const minimum = Math.min(...values);
      const maximum = Math.max(...values);
      return `${chart.title} · ${line.label}: ${numeric(minimum, chart.y_label)} to ${numeric(maximum, chart.y_label)}`;
    }),
  );
}

function explanation(study: ResearchStudy, result: ResearchResult, prediction: string) {
  const modes = (result.modes ?? []).filter(
    (mode) => Number.isFinite(mode.real) && Number.isFinite(mode.imag),
  );
  const ranges = chartRanges(result);
  const rangeLine = ranges.length ? ` Plotted ranges: ${ranges.join('; ')}.` : '';
  let detail = '';
  if (study.id === 'load-step') {
    detail = `The imposed balanced load changes from ${numeric(result.config.load_initial_pu, 'pu')} to ${numeric(result.config.load_final_pu, 'pu')}. Read the actual voltage and power trajectories around the event and compare their extrema with the returned metrics.`;
  } else if (study.id === 'modal') {
    const right = modes.filter((mode) => mode.real > 0).length;
    const left = modes.filter((mode) => mode.real < 0).length;
    const zero = modes.length - right - left;
    const reportedDamping = modes
      .map((mode) => mode.damping)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const dampingNote = reportedDamping.length
      ? ` Minimum reported damping ratio: ${numeric(Math.min(...reportedDamping), '')}.`
      : ' No finite damping ratios were returned.';
    detail = `The result contains ${modes.length} finite eigenvalues: ${left} with negative real part, ${right} with positive real part, and ${zero} on the zero-real axis.${dampingNote} Read the pole locations and participation for this configured linearization; no general stability claim follows from this page.`;
  } else if (study.id === 'forced-response') {
    detail = `The forcing is a synthetic ${numeric(result.config.forcing_frequency_hz, 'Hz')} sinusoid at ${numeric(result.config.forcing_amplitude_pu, 'pu')} amplitude. The plotted response and spectrum are generated by this model run, not by a measured grid trace.`;
  } else if (study.id === 'model-comparison') {
    detail = `Both model resolutions receive the same ${numeric(result.config.load_final_pu, 'pu')} final-load case. Any curve difference is model discrepancy between these two formulations; it does not identify which model is correct.`;
  } else {
    detail = `The modified nine-bus case uses load scale ${numeric(result.config.load_scale, 'pu')} and reports ${modes.length} finite modal locations. The operating-point and mode results describe this example model, not grid adequacy or dynamic validation.`;
  }
  return `${detail}${rangeLine}${prediction ? ` Your prediction for this run: “${prediction}”` : ' No prediction was recorded for this run.'}`;
}

function modeChoiceForPrediction(study: ResearchStudy, value: string) {
  return study.predictions.find((option) => option.value === value)?.label ?? '';
}

function SolverDetails({ result }: { result: ResearchResult }) {
  const primitives = Object.entries(result.solver).filter(
    ([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value),
  );
  return (
    <details className="research-data-details research-solver-details">
      <summary>
        Solver details{' '}
        <span>
          {primitives.length} scalar diagnostics · model {result.model}
        </span>
      </summary>
      <dl>
        {primitives.length ? (
          primitives.map(([key, value]) => (
            <div key={key}>
              <dt>{key.replaceAll('_', ' ')}</dt>
              <dd>{value === null ? 'Not reported' : String(value)}</dd>
            </div>
          ))
        ) : (
          <div>
            <dt>Solver diagnostics</dt>
            <dd>Scalars not reported</dd>
          </div>
        )}
      </dl>
    </details>
  );
}

export function ResearchStudio() {
  const initialStudyId = useMemo<ResearchStudyId>(() => {
    if (typeof window === 'undefined') return 'load-step';
    const routeStudy = new URLSearchParams(window.location.search).get('study');
    return isResearchStudyId(routeStudy) ? routeStudy : 'load-step';
  }, []);
  const [studyId, setStudyId] = useState(initialStudyId);
  const study = RESEARCH_STUDIES.find((item) => item.id === studyId)!;
  const [draft, setDraft] = useState<NumericDraft>(() => configDraft(study));
  const [prediction, setPrediction] = useState('');
  const [appliedPrediction, setAppliedPrediction] = useState('');
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [runError, setRunError] = useState<RunError | null>(null);
  const [chartFocus, setChartFocus] = useState('');
  const [pointIndex, setPointIndex] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const parsed = useMemo(() => parseConfig(study, draft), [study, draft]);
  const isDemo = import.meta.env.MODE === 'demo';
  const draftConfig = parsed.config;
  const dirty =
    result !== null &&
    (!sameConfig(draftConfig, result.config) ||
      modeChoiceForPrediction(study, prediction) !== appliedPrediction);

  useEffect(() => () => controller.current?.abort(), []);

  function updateUrl(id: ResearchStudyId) {
    const url = new URL(window.location.href);
    url.searchParams.set('study', id);
    window.history.replaceState(null, '', url);
  }

  function changeStudy(nextId: ResearchStudyId) {
    if (nextId === studyId) return;
    requestSequence.current++;
    controller.current?.abort();
    controller.current = null;
    const next = RESEARCH_STUDIES.find((item) => item.id === nextId)!;
    setStudyId(nextId);
    setDraft(configDraft(next));
    setPrediction('');
    setAppliedPrediction('');
    setResult(null);
    setBusy(false);
    setStatus('');
    setRunError(null);
    setChartFocus('');
    setPointIndex(0);
    updateUrl(nextId);
  }

  function changeField(name: string, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
    setRunError(null);
  }

  async function runStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.config || busy) return;
    controller.current?.abort();
    const activeController = new AbortController();
    controller.current = activeController;
    const sequence = ++requestSequence.current;
    const selectedId = studyId;
    const selectedPrediction = modeChoiceForPrediction(study, prediction);
    setBusy(true);
    setStatus('Preparing local numerical runtime…');
    setRunError(null);
    try {
      const response = await researchRequest<ResearchResult>('research', activeController.signal, {
        study: selectedId,
        config: parsed.config,
      });
      if (
        activeController.signal.aborted ||
        sequence !== requestSequence.current ||
        selectedId !== studyId
      )
        return;
      if (
        !response ||
        response.study_id !== selectedId ||
        !Array.isArray(response.metrics) ||
        !Array.isArray(response.charts)
      )
        throw new Error('The local worker returned an unexpected study result shape.');
      setResult(response);
      setAppliedPrediction(selectedPrediction);
      setStatus('');
      setChartFocus(response.charts[0]?.id ?? '');
      setPointIndex(0);
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      if ((cause as Error).name === 'AbortError') {
        setStatus('Run cancelled. No result was applied.');
      } else {
        const detail = (cause as Error).message || 'An unknown runtime or solver error occurred.';
        const runtimeFailure =
          /download|integrity|worker|runtime|timed out|could not start|package/i.test(detail);
        setRunError({
          title: runtimeFailure ? 'Study did not complete' : 'Study did not converge',
          detail,
        });
        setStatus('');
      }
    } finally {
      if (sequence === requestSequence.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }

  function cancelRun() {
    requestSequence.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setStatus('Run cancelled. No result was applied.');
  }

  const accentStyle = {
    '--research-accent': study.color,
    '--research-soft': study.softColor,
  } as CSSProperties;

  if (!isDemo) {
    return (
      <main className="research-studio research-hosted-only" style={accentStyle}>
        <span className="research-eyebrow">ADVANCED STUDY STUDIO</span>
        <h1>Research studies run in the browser studio</h1>
        <p>The optional Python and scientific runtime is packaged with the public static course.</p>
        <a href={'https://khanlab.co.technology/?study=' + studyId}>Open the hosted study ↗</a>
      </main>
    );
  }

  return (
    <main
      className="research-studio"
      data-testid="research-studio"
      data-study={study.id}
      style={accentStyle}
    >
      <header className="research-heading">
        <div>
          <div className="research-heading-eyebrow">
            <span /> ADVANCED POWER-DYNAMICS STUDIES <b>/</b> LOCAL PYTHON
          </div>
          <h1>{study.title}</h1>
          <p>{study.objective}</p>
        </div>
        <div className="research-engine-stamp">
          <span>NUMERICAL STUDY</span>
          <strong>{study.shortName.toUpperCase()}</strong>
          <small>{study.modelNote}</small>
        </div>
      </header>

      <nav className="research-study-nav" aria-label="Choose a power-dynamics study">
        {RESEARCH_STUDIES.map((item, index) => (
          <button
            type="button"
            key={item.id}
            aria-current={item.id === studyId ? 'page' : undefined}
            className={item.id === studyId ? 'is-current' : ''}
            style={{ '--card-accent': item.color } as CSSProperties}
            onClick={() => changeStudy(item.id)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item.shortName}</strong>
          </button>
        ))}
      </nav>

      <section className="research-setup-grid">
        <div className="research-intro-column">
          <article className="research-objective-card">
            <span className="research-eyebrow">{study.eyebrow}</span>
            <h2>One question. One configured run.</h2>
            <p>{study.teachingPoint}</p>
            <div className="research-study-objective">
              <b>Study objective</b>
              <span>{study.objective}</span>
            </div>
          </article>
          <section className="research-diagram-card">
            <div className="research-section-heading">
              <div>
                <span className="research-eyebrow">MODEL BOUNDARY</span>
                <h2>Follow the network path</h2>
              </div>
              <span className="research-concept-tag">CONCEPTUAL · NOT TO SCALE</span>
            </div>
            <ResearchDiagram key={study.id} study={study} />
          </section>
          <div className="research-model-note">
            <span className="research-note-mark">i</span>
            <p>
              <b>What this run means.</b> {study.modelNote} Study outputs are generated by the
              selected numerical model. They are not measured GPU-load traces or facility
              measurements.
            </p>
          </div>
        </div>

        <form className="research-run-panel" onSubmit={runStudy} noValidate>
          <div className="research-section-heading">
            <div>
              <span className="research-eyebrow">CONFIGURE THE CASE</span>
              <h2>Before you run</h2>
            </div>
            <span className="research-config-count">
              {study.fields.length} {study.fields.length === 1 ? 'input' : 'inputs'}
            </span>
          </div>
          <fieldset className="research-fields">
            <legend>Model inputs · ranges are bounded</legend>
            {study.fields.map((field) => (
              <label className="research-field" key={field.name}>
                <span className="research-field-label">
                  {field.label}
                  <small>{field.help}</small>
                </span>
                <span className="research-number-wrap">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={draft[field.name] ?? ''}
                    aria-label={field.label + ' in ' + field.unit}
                    data-testid={'research-input-' + field.name}
                    onChange={(event) => changeField(field.name, event.target.value)}
                  />
                  <i>{field.unit}</i>
                </span>
                <small className="research-field-range">
                  Allowed: {field.min}–{field.max} {field.unit}
                </small>
              </label>
            ))}
          </fieldset>

          <fieldset className="research-prediction">
            <legend>01 · Predict before the run</legend>
            {study.predictions.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name={'prediction-' + study.id}
                  value={option.value}
                  checked={prediction === option.value}
                  onChange={() => setPrediction(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          {!parsed.config && (
            <p className="research-input-error" role="status">
              {parsed.error}
            </p>
          )}
          {runError && (
            <div className="research-run-error" role="alert">
              <b>{runError.title}</b>
              <p>{runError.detail}</p>
              <span>
                No output from this attempt was applied. Correct the inputs or retry the local run.
              </span>
            </div>
          )}
          {result && dirty && (
            <p className="research-draft-status" role="status">
              <b>Draft changed.</b> Charts and metrics below remain tagged to the last applied
              inputs until a successful new run.
            </p>
          )}
          {status && !busy && (
            <p className="research-cancelled-status" role="status">
              {status}
            </p>
          )}
          <button
            className="research-run-button"
            type="submit"
            disabled={busy || !parsed.config}
            data-testid="research-run"
          >
            {busy ? (
              <>
                <span className="research-spinner" aria-hidden="true" /> Preparing local study…
              </>
            ) : (
              <>
                Run {study.shortName.toLowerCase()} <span aria-hidden="true">↗</span>
              </>
            )}
          </button>
          <div className="research-runtime-note">
            <b>Local scientific runtime</b>
            <span>
              The first run may download about 31 MB: a 14 MB Python base plus 17 MB scientific
              packages. Calculation runs in a browser worker. Nothing starts until you press Run.
            </span>
          </div>
          {busy && (
            <div className="research-busy" role="status" aria-live="polite">
              <span className="research-spinner" />{' '}
              <span>Preparing local numerical runtime… The active worker can be cancelled.</span>
              <button type="button" onClick={cancelRun} data-testid="research-cancel">
                Cancel
              </button>
            </div>
          )}
          <p className="research-bounds-note">
            Inputs are checked against the displayed bounds. Out-of-range values remain visible; no
            automatic clamp is applied.
          </p>
        </form>
      </section>

      <section
        className="research-results"
        aria-label="Study output"
        data-testid="research-results"
      >
        <div className="research-results-heading">
          <div>
            <span className="research-eyebrow">02 · RUN / 03 · EXPLAIN</span>
            <h2>Results from the applied case</h2>
          </div>
          {result && (
            <div className={'research-applied-tag' + (dirty ? ' is-dirty' : '')}>
              <i />
              {dirty ? 'Showing prior applied run' : 'Applied result'}
            </div>
          )}
        </div>
        {result ? (
          <>
            <div className="research-result-provenance">
              <span>
                <b>Applied inputs</b>
                {configLabel(study, result.config)}
              </span>
              <span>
                <b>Numerical model</b>
                {result.model}
              </span>
              <span>
                <b>Result belongs to</b>
                {study.shortName} · {result.study_id}
              </span>
            </div>
            <div className="research-metrics" aria-label="Returned numerical metrics">
              {result.metrics.length ? (
                result.metrics.map((metric, index) => (
                  <article
                    className="research-metric"
                    key={metric.label + index}
                    style={{ '--metric-accent': study.color } as CSSProperties}
                  >
                    <span>{metric.label}</span>
                    <strong>{numeric(metric.value, metric.unit)}</strong>
                    <small>
                      {metric.value === null
                        ? 'Explicitly not reported'
                        : 'Returned by the numerical model'}
                    </small>
                  </article>
                ))
              ) : (
                <p className="research-muted">No scalar metrics were returned for this study.</p>
              )}
            </div>

            {result.modes && result.modes.length > 0 && (
              <ModePlot result={result} accent={study.color} />
            )}

            <div className="research-charts-heading">
              <div>
                <span className="research-eyebrow">MODEL OUTPUT</span>
                <h2>Trace the computed values</h2>
              </div>
              <span>Real output arrays · reported axes · {result.charts.length} charts</span>
            </div>
            {result.charts.length ? (
              <div className="research-charts">
                {result.charts.map((chart) => (
                  <ResearchChart
                    key={chart.id}
                    chart={chart}
                    accent={study.color}
                    active={chartFocus === chart.id}
                    onFocus={() => {
                      setChartFocus(chart.id);
                      setPointIndex(0);
                    }}
                    pointIndex={chartFocus === chart.id ? pointIndex : 0}
                    onPointChange={setPointIndex}
                  />
                ))}
              </div>
            ) : (
              <p className="research-empty-output">
                The solver returned no chart arrays. No synthetic chart was substituted.
              </p>
            )}

            <section className="research-explanation-card">
              <div className="research-section-heading">
                <div>
                  <span className="research-eyebrow">03 · EXPLAIN</span>
                  <h2>Compare your prediction with the run</h2>
                </div>
                <span className="research-applied-tag">
                  <i />
                  {appliedPrediction ? 'Prediction recorded' : 'No prediction'}
                </span>
              </div>
              <div className="research-prediction-result">
                <span>Applied prediction</span>
                <strong>{appliedPrediction || 'No prediction was recorded for this run.'}</strong>
              </div>
              <p>{explanation(study, result, appliedPrediction)}</p>
            </section>

            <section className="research-export-card">
              <div className="research-section-heading">
                <div>
                  <span className="research-eyebrow">REPRODUCIBILITY</span>
                  <h2>Keep the returned data</h2>
                </div>
                <div className="research-export-actions">
                  <button
                    type="button"
                    onClick={() =>
                      save(
                        'power-study-' + cleanFilePart(study.id) + '.json',
                        JSON.stringify(result, null, 2),
                        'application/json',
                      )
                    }
                    data-testid="research-export-json"
                  >
                    Download JSON
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      save(
                        'power-study-' + cleanFilePart(study.id) + '-charts.csv',
                        csvResult(result),
                        'text/csv;charset=utf-8',
                      )
                    }
                    disabled={!result.charts.length}
                    data-testid="research-export-csv"
                  >
                    Download chart CSV
                  </button>
                </div>
              </div>
              <p>
                JSON includes the applied configuration, solver fields, assumptions, all metrics,
                and complete chart arrays. CSV contains every returned x/y sample for every plotted
                series.
              </p>
              <SolverDetails result={result} />
            </section>

            <details className="research-assumptions">
              <summary>
                <span>
                  <span className="research-eyebrow">MODEL SCOPE</span>
                  <strong>Assumptions and limitations</strong>
                </span>
                <i>Open details</i>
              </summary>
              <div>
                <ul>
                  {result.assumptions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
                <p>{study.teachingPoint}</p>
                <a
                  href="https://khanlab.co.technology/studies/power-dynamics/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Study methods and assumptions ↗
                </a>
              </div>
            </details>
          </>
        ) : (
          <div className="research-no-result">
            <div className="research-no-result-mark">
              {busy ? <span className="research-spinner" /> : '∿'}
            </div>
            <div>
              <strong>
                {busy ? 'Preparing the local numerical runtime' : 'No applied result yet'}
              </strong>
              <p>
                {busy
                  ? 'The worker is loading the numerical packages and solving the selected case. It is running locally in this browser.'
                  : 'Make a prediction, review the input bounds, then run the selected numerical study. No charts or outputs are invented before the solver responds.'}
              </p>
            </div>
            <button type="button" disabled aria-disabled="true">
              Download JSON
            </button>
          </div>
        )}
      </section>

      <footer className="research-footer">
        <a href="?lesson=ride-through">← Back to the 12-lesson continuity course</a>
        <a
          href="https://khanlab.co.technology/studies/power-dynamics/"
          target="_blank"
          rel="noreferrer"
        >
          Methods and study limitations ↗
        </a>
        <span>Teaching models · no facility or GPU trace validation</span>
      </footer>
    </main>
  );
}
