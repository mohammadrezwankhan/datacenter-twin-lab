import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  DEFAULT_EMT,
  EMT_LIMITS,
  EMT_PRESETS,
  refineEmt,
  simulateEmt,
  validateEmt,
} from './engine';
import type { EmtConfig, EmtResult } from './engine';
import { EmtCharts } from './Charts';
import { EmtScene, type DeviceId } from './Scene';
import { EmtVerification } from './Verification';
import './study.css';

type Field = keyof EmtConfig;
type Draft = Record<Field, string>;

const fields: { key: Field; label: string; unit: string; step: string; help: string }[] = [
  {
    key: 'source_v',
    label: 'Nominal source',
    unit: 'V',
    step: '1',
    help: 'Ideal DC source before and after the sag.',
  },
  {
    key: 'resistance_ohm',
    label: 'Series resistance',
    unit: 'Ω',
    step: '0.01',
    help: 'Damping in the source path.',
  },
  {
    key: 'inductance_mh',
    label: 'Series inductance',
    unit: 'mH',
    step: '0.1',
    help: 'Limits how quickly source current changes.',
  },
  {
    key: 'capacitance_mf',
    label: 'DC-link capacitance',
    unit: 'mF',
    step: '0.1',
    help: 'Stores energy across the bus.',
  },
  {
    key: 'load_ohm',
    label: 'Resistive load',
    unit: 'Ω',
    step: '0.1',
    help: 'Constant resistance across the DC bus.',
  },
  {
    key: 'sag_pu',
    label: 'Sag level',
    unit: 'pu',
    step: '0.01',
    help: 'Source voltage during the event as a fraction of nominal.',
  },
  { key: 'sag_start_ms', label: 'Sag begins', unit: 'ms', step: '1', help: 'Event start time.' },
  {
    key: 'sag_duration_ms',
    label: 'Sag duration',
    unit: 'ms',
    step: '1',
    help: 'Event length; it must clear before the study ends.',
  },
  {
    key: 'duration_ms',
    label: 'Study duration',
    unit: 'ms',
    step: '1',
    help: 'Displayed window, including recovery.',
  },
];

const number = (value: number, digits = 2) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(
    value,
  );
const signed = (value: number, digits = 6) =>
  `${value > 0 ? '+' : ''}${new Intl.NumberFormat('en', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)}`;
const toDraft = (config: EmtConfig): Draft =>
  Object.fromEntries(
    (Object.keys(config) as Field[]).map((key) => [key, String(config[key])]),
  ) as Draft;

function parseDraft(draft: Draft): { config?: EmtConfig; error?: string } {
  const values: Partial<Record<Field, number>> = {};
  for (const key of Object.keys(draft) as Field[]) {
    if (draft[key].trim() === '')
      return { error: 'Enter a number for every field. Values are never silently clamped.' };
    const value = Number(draft[key]);
    if (!Number.isFinite(value))
      return { error: 'Every field must be a finite number. Values are never silently clamped.' };
    values[key] = value;
  }
  try {
    return { config: validateEmt(values as EmtConfig) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvFor(result: EmtResult) {
  const header = [
    'time_ms',
    'source_v',
    'bus_v',
    'source_a',
    'load_a',
    'stored_j',
    'balance_error_j',
  ];
  const rows = result.rows.map((row) =>
    [
      row.time_ms,
      row.source_v,
      row.bus_v,
      row.source_a,
      row.load_a,
      row.stored_j,
      row.balance_error_j,
    ].join(','),
  );
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

function nearestRowIndex(result: EmtResult, timeMs: number) {
  let best = 0;
  let distance = Infinity;
  result.rows.forEach((row, index) => {
    const next = Math.abs(row.time_ms - timeMs);
    if (next < distance) {
      best = index;
      distance = next;
    }
  });
  return best;
}

function predictionExplanation(result: EmtResult, prediction: string) {
  if (!prediction)
    return 'Choose a prediction before the next run to compare it with the sampled trace.';
  const config = result.config;
  const start = result.rows[nearestRowIndex(result, config.sag_start_ms)];
  const minimum = result.rows.reduce(
    (lowest, row) => (row.bus_v < lowest.bus_v ? row : lowest),
    result.rows[0],
  );
  return `At the ${number(config.sag_start_ms)} ms event boundary, the sampled source is ${number(start.source_v, 1)} V while the bus is ${number(start.bus_v, 1)} V. The sampled bus minimum is ${number(minimum.bus_v, 1)} V at ${number(minimum.time_ms, 2)} ms. Capacitor voltage is a continuous state, and series inductance limits current change; the input can step before the bus responds. The selected idea was: “${prediction}”`;
}

export function EmtStudy() {
  const initialResult = useMemo(() => simulateEmt(DEFAULT_EMT), []);
  const [result, setResult] = useState(initialResult);
  const [draft, setDraft] = useState<Draft>(() => toDraft(DEFAULT_EMT));
  const [presetId, setPresetId] = useState('voltage-sag');
  const [formError, setFormError] = useState('');
  const [prediction, setPrediction] = useState('');
  const [appliedPrediction, setAppliedPrediction] = useState('');
  const [sampleIndex, setSampleIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceId>('source');
  const [comparison, setComparison] = useState<{
    step: number;
    fineStep: number;
    difference: number;
  } | null>(null);
  const [comparisonError, setComparisonError] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const replayStartIndex = useRef(0);
  const parsed = useMemo(() => parseDraft(draft), [draft]);
  const dirty =
    !parsed.config ||
    (Object.keys(DEFAULT_EMT) as Field[]).some((key) => parsed.config![key] !== result.config[key]);
  const row = result.rows[Math.min(sampleIndex, result.rows.length - 1)] ?? result.rows[0]!;
  const currentTimeMs = row.time_ms;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const totalFramesMs = Math.max(4800, result.config.duration_ms * 28);
    const startingIndex = replayStartIndex.current;
    const startingTime =
      performance.now() - (startingIndex / Math.max(1, result.rows.length - 1)) * totalFramesMs;
    let frame = 0;
    let lastIndex = startingIndex;
    const advance = (now: number) => {
      const fraction = Math.min(1, Math.max(0, (now - startingTime) / totalFramesMs));
      const next = Math.min(
        result.rows.length - 1,
        Math.round(fraction * (result.rows.length - 1)),
      );
      if (next !== lastIndex) {
        lastIndex = next;
        setSampleIndex(next);
      }
      if (fraction >= 1) setPlaying(false);
      else frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [playing, result]);

  function choosePreset(id: string) {
    const preset = EMT_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setPresetId(id);
    setDraft(toDraft(preset.config));
    setFormError('');
  }

  function editField(key: Field, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setPresetId('custom');
    setFormError('');
  }

  function runStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = parseDraft(draft);
    if (!candidate.config) {
      setFormError(candidate.error ?? 'Check the study inputs.');
      return;
    }
    try {
      const next = simulateEmt(candidate.config);
      setResult(next);
      setDraft(toDraft(next.config));
      setFormError('');
      setAppliedPrediction(prediction);
      setSampleIndex(0);
      setPlaying(false);
      setComparison(null);
      setComparisonError('');
    } catch (error) {
      setFormError((error as Error).message);
    }
  }

  function jumpTo(timeMs: number) {
    setPlaying(false);
    setSampleIndex(nearestRowIndex(result, timeMs));
  }

  function seek(index: number) {
    setPlaying(false);
    setSampleIndex(index);
  }

  function compareStep() {
    setComparisonError('');
    try {
      const refined = refineEmt(result.config);
      setComparison({
        step: refined.coarse.config.step_us,
        fineStep: refined.fine.config.step_us,
        difference: refined.max_bus_difference_v,
      });
    } catch (error) {
      setComparison(null);
      setComparisonError((error as Error).message);
    }
  }

  const eventEnd = result.config.sag_start_ms + result.config.sag_duration_ms;
  const minuteSampledRows = result.rows.filter(
    (sample, index) =>
      index % 10 === 0 ||
      index === sampleIndex ||
      Math.abs(sample.time_ms - result.config.sag_start_ms) < 1e-9 ||
      Math.abs(sample.time_ms - eventEnd) < 1e-9,
  );
  const predictionText = predictionExplanation(result, appliedPrediction);
  const canCompare = [10, 20, 50].includes(result.config.step_us);

  return (
    <div className="emt-study" data-testid="emt-study">
      <header className="emt-heading">
        <div>
          <div className="emt-eyebrow">
            <span /> EMT STUDY <b>/</b> DC-LINK TRANSIENTS
          </div>
          <h1>Inside a voltage sag</h1>
          <p>Change a 200 ms electrical event. See what happens between continuity snapshots.</p>
        </div>
        <div className="emt-model-stamp">
          <span>MODEL</span>
          <strong>DC-LINK RLC</strong>
          <small>local · deterministic</small>
        </div>
      </header>

      <section className="emt-top-grid" aria-label="Circuit and study controls">
        <div className="emt-panel emt-scene-panel">
          <div className="emt-panel-heading">
            <div>
              <span className="emt-kicker">LIVE CIRCUIT VIEW</span>
              <h2>Follow the stored energy</h2>
            </div>
            <span className="emt-status">
              <i /> {playing ? 'REPLAYING' : 'PAUSED'}
            </span>
          </div>
          <EmtScene
            config={result.config}
            row={row}
            peakCurrentA={result.summary.peak_source_a}
            playing={playing && !reducedMotion}
            selected={selectedDevice}
            onSelect={setSelectedDevice}
          />
          <div className="emt-current-caption">
            <span>Inspection time</span>
            <strong>{number(currentTimeMs, 2)} ms</strong>
            <small>Sampled state · {result.sample_step_us} µs output interval</small>
          </div>
        </div>

        <form className="emt-panel emt-controls" onSubmit={runStudy} noValidate>
          <div className="emt-panel-heading">
            <div>
              <span className="emt-kicker">SET THE EVENT</span>
              <h2>Study inputs</h2>
            </div>
            <span className="emt-unit-chip">SI units</span>
          </div>
          <label className="emt-preset-label" htmlFor="emt-preset">
            Start from a case
          </label>
          <select
            id="emt-preset"
            value={presetId}
            onChange={(event) => choosePreset(event.target.value)}
          >
            <option value="custom">Custom draft</option>
            {EMT_PRESETS.map((preset) => (
              <option value={preset.id} key={preset.id}>
                {preset.name} — {preset.description}
              </option>
            ))}
          </select>
          <fieldset className="emt-fields">
            <legend>Model parameters and event timing</legend>
            {fields.map((field) => {
              const [min, max] = EMT_LIMITS[field.key];
              return (
                <label className="emt-field" key={field.key}>
                  <span>
                    {field.label}
                    <small>{field.help}</small>
                  </span>
                  <span className="emt-field-entry">
                    <input
                      aria-label={field.label + ' (' + field.unit + ')'}
                      data-testid={'emt-' + field.key}
                      type="number"
                      inputMode="decimal"
                      min={min}
                      max={max}
                      step={field.step}
                      value={draft[field.key]}
                      onChange={(event) => editField(field.key, event.target.value)}
                    />
                    <i>{field.unit}</i>
                  </span>
                </label>
              );
            })}
            <label className="emt-field emt-step-field">
              <span>
                Integration step<small>RK4 internal step; exported rows every 100 µs.</small>
              </span>
              <span className="emt-field-entry">
                <select
                  aria-label="Integration step (µs)"
                  data-testid="emt-step-us"
                  value={draft.step_us}
                  onChange={(event) => editField('step_us', event.target.value)}
                >
                  {[5, 10, 20, 25, 50].map((step) => (
                    <option value={step} key={step}>
                      {step}
                    </option>
                  ))}
                </select>
                <i>µs</i>
              </span>
            </label>
          </fieldset>

          <fieldset className="emt-prediction">
            <legend>01 · Make a prediction</legend>
            <label>
              <input
                type="radio"
                name="emt-prediction"
                value="instant"
                checked={prediction === 'The bus voltage falls to the source level immediately.'}
                onChange={() =>
                  setPrediction('The bus voltage falls to the source level immediately.')
                }
              />
              <span>The bus voltage falls to the source level immediately.</span>
            </label>
            <label>
              <input
                type="radio"
                name="emt-prediction"
                value="stored"
                checked={prediction === 'Stored energy delays the response; ringing is possible.'}
                onChange={() =>
                  setPrediction('Stored energy delays the response; ringing is possible.')
                }
              />
              <span>Stored energy delays the response; ringing is possible.</span>
            </label>
          </fieldset>

          {dirty && (
            <p className="emt-draft-note" role="status">
              <b>Draft changed.</b> Current outputs still use the last applied configuration.
            </p>
          )}
          {formError && (
            <p className="emt-error" role="alert">
              {formError}
            </p>
          )}
          {!formError && parsed.error && (
            <p className="emt-inline-error" role="status">
              {parsed.error}
            </p>
          )}
          <button className="emt-run-button" type="submit" data-testid="emt-run">
            Run study <span aria-hidden="true">↗</span>
          </button>
          <p className="emt-control-foot">
            All values are checked against stated bounds. Invalid drafts remain visible and are
            never silently adjusted.
          </p>
        </form>
      </section>

      <section
        className="emt-result-strip"
        aria-label="Applied run results"
        data-testid="emt-results"
      >
        <div className="emt-result-strip-heading">
          <span className="emt-kicker">APPLIED RUN · {result.config.duration_ms} ms WINDOW</span>
          <span>
            {dirty
              ? 'Outputs shown are from the previous applied run.'
              : 'Values shown are from the applied configuration.'}
          </span>
        </div>
        <div className="emt-metrics">
          <article className="emt-metric metric-dip">
            <span>Minimum bus voltage</span>
            <strong>
              {number(result.summary.minimum_bus_v, 2)} <i>V</i>
            </strong>
            <small>
              Integration-step minimum · initial {number(result.summary.initial_bus_v, 1)} V
            </small>
          </article>
          <article className="emt-metric metric-current">
            <span>Peak source current</span>
            <strong>
              {number(result.summary.peak_source_a, 2)} <i>A</i>
            </strong>
            <small>Largest absolute value · reverse flow is allowed</small>
          </article>
          <article className="emt-metric metric-recovery">
            <span>Recovery peak</span>
            <strong>
              {number(result.summary.recovery_peak_v, 2)} <i>V</i>
            </strong>
            <small>After the source event clears</small>
          </article>
          <article className="emt-metric metric-balance">
            <span>Energy balance residual</span>
            <strong>
              {result.summary.balance_error_j.toExponential(2)} <i>J</i>
            </strong>
            <small>Source − losses − load − stored-energy change</small>
          </article>
        </div>
      </section>

      <section className="emt-panel emt-replay-panel" aria-label="Sampled transient replay">
        <div className="emt-panel-heading">
          <div>
            <span className="emt-kicker">INSPECT THE TRANSIENT</span>
            <h2>Replay the sampled states</h2>
          </div>
          <span className="emt-slow-tag">REPLAY SLOWED FOR INSPECTION</span>
        </div>
        <div className="emt-replay-controls">
          <button
            type="button"
            className="emt-play"
            onClick={() => {
              if (playing) setPlaying(false);
              else {
                const start = sampleIndex >= result.rows.length - 1 ? 0 : sampleIndex;
                replayStartIndex.current = start;
                setSampleIndex(start);
                setPlaying(true);
              }
            }}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            data-testid="emt-play"
          >
            {playing ? 'Ⅱ' : '▶'} <span>{playing ? 'Pause' : 'Play'}</span>
          </button>
          <label className="emt-seek-label" htmlFor="emt-seek">
            <span>Seek through {result.config.duration_ms} ms</span>
            <span aria-live="polite">{number(currentTimeMs, 2)} ms</span>
          </label>
          <input
            id="emt-seek"
            className="emt-seek"
            type="range"
            min="0"
            max={result.rows.length - 1}
            step="1"
            value={sampleIndex}
            aria-valuetext={number(currentTimeMs, 2) + ' milliseconds'}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <div className="emt-jumps">
            <button type="button" onClick={() => jumpTo(result.config.sag_start_ms)}>
              Jump to sag · {result.config.sag_start_ms} ms
            </button>
            <button type="button" onClick={() => jumpTo(eventEnd)}>
              Jump to recovery · {eventEnd} ms
            </button>
          </div>
        </div>
        <div className="emt-replay-foot">
          <span>
            {reducedMotion
              ? 'Reduced-motion preference detected. Replay is user-started with motion effects disabled.'
              : 'Starts paused. Press Play to move through actual sampled solver rows.'}
          </span>
          <span>Source current may be negative; graph scale includes signed values.</span>
        </div>
      </section>

      <section className="emt-panel emt-chart-panel">
        <div className="emt-panel-heading">
          <div>
            <span className="emt-kicker">TIME-DOMAIN RESPONSE</span>
            <h2>Source and bus are different states</h2>
          </div>
          <span className="emt-chart-note">Full observed range · units shown on axes</span>
        </div>
        <EmtCharts result={result} timeMark={currentTimeMs} />
      </section>

      <section className="emt-analysis-grid">
        <div className="emt-panel emt-explain-panel">
          <div className="emt-panel-heading">
            <div>
              <span className="emt-kicker">02 · RUN</span>
              <h2>What did the model do?</h2>
            </div>
            <span className="emt-result-label">{result.model}</span>
          </div>
          <div className="emt-prediction-callout">
            <span>Your prediction</span>
            <strong>{appliedPrediction || 'No prediction recorded for this run.'}</strong>
          </div>
          <div className="emt-explanation" aria-live="polite">
            <span className="emt-explain-icon">↳</span>
            <p>{predictionText}</p>
          </div>
          <div className="emt-explain-limits">
            <b>Read the event carefully.</b> The source voltage is imposed as an input step. Bus
            voltage and inductor current evolve from the differential equations; this network has no
            switching controls or UPS behavior.
          </div>
        </div>
        <div className="emt-panel emt-numerical-panel">
          <div className="emt-panel-heading">
            <div>
              <span className="emt-kicker">NUMERICAL CHECK</span>
              <h2>Refine the time step</h2>
            </div>
            <span className="emt-unit-chip">OPTIONAL</span>
          </div>
          <p>
            Re-run the same applied case with half the internal RK4 step and compare sampled bus
            voltage.
          </p>
          <button
            type="button"
            className="emt-secondary-button"
            onClick={compareStep}
            disabled={!canCompare}
            data-testid="emt-refine"
          >
            Compare with half step
          </button>
          {!canCompare && (
            <p className="emt-inline-note">
              Choose 10, 20 or 50 µs for a half-step pair; 5 and 25 µs are not supported.
            </p>
          )}
          {comparisonError && (
            <p className="emt-error" role="alert">
              {comparisonError}
            </p>
          )}
          {comparison && (
            <div className="emt-comparison-result" role="status">
              <strong>{comparison.difference.toExponential(3)} V</strong>
              <span>maximum absolute sampled bus-voltage difference</span>
              <small>
                {comparison.step} µs coarse · {comparison.fineStep} µs refined
              </small>
            </div>
          )}
          <p className="emt-inline-note">
            This is a time-step comparison for the authored model, not an accuracy guarantee or
            validation against a reference implementation.
          </p>
        </div>
      </section>

      <section className="emt-panel emt-export-panel">
        <div className="emt-panel-heading">
          <div>
            <span className="emt-kicker">TAKE THE RESULT</span>
            <h2>Inspect the applied data</h2>
          </div>
          <div className="emt-export-actions">
            <button
              type="button"
              onClick={() =>
                download(
                  'emt-study-result.json',
                  JSON.stringify(result, null, 2),
                  'application/json',
                )
              }
              data-testid="emt-export-json"
            >
              Download JSON
            </button>
            <button
              type="button"
              onClick={() =>
                download('emt-study-samples.csv', csvFor(result), 'text/csv;charset=utf-8')
              }
              data-testid="emt-export-csv"
            >
              Download sample CSV
            </button>
          </div>
        </div>
        <p className="emt-table-caption">
          Readable excerpt at 1 ms intervals plus the current and event-boundary samples. CSV
          contains every 100 µs output row; JSON contains the full applied result and assumptions.
        </p>
        <details className="emt-samples">
          <summary>
            Open sampled values{' '}
            <span>{minuteSampledRows.length} displayed rows · 100 µs underlying output</span>
          </summary>
          <div className="emt-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time · ms</th>
                  <th>Source · V</th>
                  <th>Bus · V</th>
                  <th>Source current · A</th>
                  <th>Load current · A</th>
                  <th>Stored energy · J</th>
                  <th>Balance error · J</th>
                </tr>
              </thead>
              <tbody>
                {minuteSampledRows.map((sample, index) => (
                  <tr
                    key={sample.time_ms + '-' + index}
                    aria-current={
                      result.rows[sampleIndex]?.time_ms === sample.time_ms ? 'time' : undefined
                    }
                  >
                    <td>{number(sample.time_ms, 2)}</td>
                    <td>{number(sample.source_v, 2)}</td>
                    <td>{number(sample.bus_v, 2)}</td>
                    <td>{signed(sample.source_a, 3)}</td>
                    <td>{number(sample.load_a, 3)}</td>
                    <td>{number(sample.stored_j, 3)}</td>
                    <td>{signed(sample.balance_error_j, 7)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <EmtVerification result={result} />

      <details className="emt-panel emt-assumptions">
        <summary>
          <span>
            <span className="emt-kicker">MODEL SCOPE</span>
            <strong>Source and assumptions</strong>
          </span>
          <i>Expand details</i>
        </summary>
        <div className="emt-assumption-body">
          <p>
            This lesson is an independently authored ideal DC-equivalent source feeding a series R–L
            path, a shunt capacitor and a constant-resistance load. It solves current and voltage
            states over time; it is not a converter switching simulation.
          </p>
          <ul>
            {result.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
          <p className="emt-boundary-note">
            The ideal source can absorb reverse current. There is no blocking diode, voltage clamp,
            rectifier, UPS battery or control loop. All parameters are illustrative and
            uncalibrated.
          </p>
          <a
            href="https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/docs/studies/emt.md"
            target="_blank"
            rel="noreferrer"
          >
            Study model and derivation on GitHub ↗
          </a>
        </div>
      </details>

      <footer className="emt-footer">
        <a href="?lesson=battery">← Back to the continuity course</a>
        <span>Educational transient model · not facility validation</span>
        <span>
          Rows: {result.rows.length} · internal step: {result.config.step_us} µs
        </span>
      </footer>
    </div>
  );
}
