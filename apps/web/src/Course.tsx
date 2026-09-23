import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { lessons, lessonScenario, type Lesson } from './course-lessons';
import { n, request } from './client';
import type { Run, SiteScenario } from './types';
import { RunTools } from './RunTools';
import { PythonVerification } from './PythonVerification';
import { CourseMap } from './CourseMap';
import { courseThemes } from './course-themes';
import { LessonScene } from './LessonScene';
import './course-experience.css';

type Planning = {
  schema_version: 1;
  run_id: string;
  input_sha256: string;
  assumptions: Record<string, unknown>;
  facility_energy_kwh: string;
  it_energy_kwh: string;
  non_it_energy_kwh: string;
  limitations: string[];
};
type LessonValue = string | number | null | undefined;

const equations: Record<string, { formula: string; note: string }> = {
  'power-energy': {
    formula: 'Energy = power × time',
    note: 'A constant power over a known duration gives an energy quantity.',
  },
  'distribution-loss': {
    formula: 'Required source power = IT demand ÷ efficiency',
    note: 'This requirement can exceed available supply or path capacity. Inspect served power as well as source energy.',
  },
  'ride-through': {
    formula: 'Ride-through = stored kWh × 0.90 × 0.95 ÷ kW × 3,600',
    note: 'Charging is disabled in this lesson. Elapsed depletion time also includes the 300 seconds before the outage.',
  },
  'generator-delay': {
    formula: 'Scheduled ready time = outage time + startup delay',
    note: 'Stored energy must last across the delay. Scheduled readiness and actual generator service are separate checks.',
  },
  'generator-failure': {
    formula: 'Unserved duration = recovery time − depletion time',
    note: 'This relationship describes the failed-generator case. Available generation changes the event sequence.',
  },
  'n-plus-one': {
    formula: 'Surviving-path IT limit = gross path kW × efficiency',
    note: 'A second path helps only if the surviving path can carry the required load.',
  },
  'shared-controls': {
    formula: 'Shared dependency → simultaneous path loss',
    note: 'Removing one shared dependency can preserve a path, while its capacity can still limit delivery.',
  },
  'single-point': {
    formula: 'Unserved energy = unmet kW × outage seconds ÷ 3,600',
    note: 'Downstream redundancy does not remove a common upstream failure.',
  },
  precharge: {
    formula: 'Outage reserve = opening energy + stored charge before failure',
    note: 'Charging has its own efficiency. Available source capacity and battery capacity also constrain charge.',
  },
  'ai-outage': {
    formula: '50× power and 50× energy → the same ride-through ratio',
    note: 'The half-reserve case includes charging before the outage. This is aggregate electrical demand.',
  },
  'recovery-deadline': {
    formula: 'Service gap = max(0, recovery time − depletion time)',
    note: 'An event can split a nominal simulation step. A fraction of a second still belongs in the energy ledger.',
  },
  pue: {
    formula: 'Annual facility energy = IT kW × 8,760 h × assumed PUE',
    note: 'Non-IT energy is the difference between facility and IT energy. PUE is separate from continuity losses.',
  },
};

function lessonValue(lesson: Lesson, run: Run | null, planning: Planning | null): LessonValue {
  if (planning) return planning.facility_energy_kwh;
  if (!run) return undefined;
  if (lesson.resultKey === 'depletion')
    return run.events.find((event) => event.action === 'battery_depleted')?.at_s;
  if (lesson.resultKey === 'generator_ready') {
    const generator = run.scenario.assets.find((asset) => asset.kind === 'generator')?.id;
    return run.intervals.find((row) => generator && row.asset_states[generator] === 'running')
      ?.start_s;
  }
  return run.summary[lesson.resultKey];
}

function shown(value: LessonValue) {
  return value === undefined || value === null ? 'No event in this run' : n(value, 6);
}

function download(value: Run | Planning, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Course() {
  const route = new URLSearchParams(window.location.search).get('lesson');
  const [id, setId] = useState(lessons.some((item) => item.id === route) ? route! : lessons[0].id);
  const lesson = lessons.find((item) => item.id === id)!;
  const theme = courseThemes[id];
  const position = lessons.indexOf(lesson);
  const [value, setValue] = useState(lesson.initial);
  const [usedValue, setUsedValue] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [reference, setReference] = useState<{ result: LessonValue } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState(false);
  const [prediction, setPrediction] = useState('');
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [intervalIndex, setIntervalIndex] = useState(0);
  const [motion, setMotion] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const active = useRef<AbortController | null>(null);
  const intro = useRef<HTMLElement | null>(null);
  const navigationPending = useRef(false);

  function chooseLesson(nextId: string) {
    if (nextId === id) return;
    navigationPending.current = true;
    setId(nextId);
  }

  async function calculate(input: string) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      const base = await request<SiteScenario>(`demo?preset=${lesson.preset}`, controller.signal);
      const scenario = lessonScenario(lesson, base, input);
      let nextRun: Run | null = null;
      let nextPlanning: Planning | null = null;
      if (lesson.id === 'pue') {
        nextPlanning = await request<Planning>('planning', controller.signal, {
          schema_version: 1,
          id: 'course-pue',
          name: '50 MW annual energy planning',
          currency: 'USD',
          it_capacity_kw: '50000',
          tariff_per_kwh: null,
          price_status: 'unknown',
          assumption_date: '2026-09-12',
          source_ids: ['EDU-POWER-001'],
          segments: [
            {
              label: 'Assumed constant annual load',
              hours: '8760',
              it_load_kw: '50000',
              assumed_pue: input,
            },
          ],
        });
      } else {
        nextRun = await request<Run>('simulations', controller.signal, scenario);
      }
      if (controller.signal.aborted) return;
      setRun(nextRun);
      setPlanning(nextPlanning);
      setUsedValue(input);
      setIntervalIndex(0);
      if (input === lesson.initial)
        setReference({ result: lessonValue(lesson, nextRun, nextPlanning) });
    } catch (cause) {
      if (!controller.signal.aborted) setError((cause as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  useEffect(() => {
    setValue(lesson.initial);
    setUsedValue('');
    setRun(null);
    setPlanning(null);
    setReference(null);
    setAnswer(false);
    setPrediction('');
    setIntervalIndex(0);
    void calculate(lesson.initial);
    const url = new URL(window.location.href);
    url.searchParams.set('lesson', lesson.id);
    window.history.replaceState(null, '', url);
    if (navigationPending.current) {
      intro.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      navigationPending.current = false;
    }
    return () => active.current?.abort();
  }, [id]);

  const result = lessonValue(lesson, run, planning);
  const dirty = usedValue !== '' && value !== usedValue;
  const numericPrediction = prediction.trim() !== '' && Number.isFinite(Number(prediction));
  const comparable = result !== undefined && result !== null && numericPrediction && !dirty;
  const reviewed = reviewedIds.includes(id);
  const completed = !!run || !!planning;
  const noDepletion = completed && lesson.resultKey === 'depletion' && result === undefined;
  const noGeneration = completed && lesson.resultKey === 'generator_ready' && result === undefined;

  return (
    <div
      className="course course-studio"
      data-testid="course"
      data-lesson={id}
      style={
        { '--lesson-accent': theme.accent, '--lesson-soft': theme.softAccent } as CSSProperties
      }
    >
      <CourseMap selectedId={id} reviewedIds={reviewedIds} onSelect={chooseLesson} />
      <section className="lesson-intro" aria-label="Current lesson" ref={intro}>
        <div className="lesson-number" aria-hidden="true">
          {String(position + 1).padStart(2, '0')}
        </div>
        <div className="lesson-intro-copy">
          <div className="eyebrow">
            {theme.chapter} <span> / </span> {lesson.concept}
          </div>
          <h2>{theme.shortTitle}</h2>
          <p>{theme.objective}</p>
        </div>
        <div className="lesson-position">
          <span>LESSON</span>
          <b>
            {position + 1}
            <small> / 12</small>
          </b>
        </div>
      </section>
      <div className="lesson-studio-grid">
        <div className="lesson-visual-column">
          <LessonScene
            lesson={lesson}
            run={run}
            planning={planning}
            intervalIndex={intervalIndex}
            onIntervalChange={setIntervalIndex}
            motion={motion}
            onMotionChange={setMotion}
          />
          <div className="lesson-principle">
            <span className="eyebrow">THE RELATIONSHIP</span>
            <strong>{equations[id].formula}</strong>
            <p>{equations[id].note}</p>
          </div>
        </div>
        <section className="lesson-lab" aria-label="Lesson experiment">
          <div className="lesson-lab-heading">
            <span className="eyebrow">YOUR EXPERIMENT</span>
            <span>01 → 02 → 03</span>
          </div>
          <h3>{lesson.question}</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void calculate(value);
            }}
          >
            <div className="lesson-step-heading">
              <b>01</b>
              <span>Configure one assumption</span>
            </div>
            <label className="lesson-input-label">
              {lesson.label} {lesson.unit && `(${lesson.unit})`}
              <input
                type="number"
                required
                value={value}
                min={lesson.min}
                max={lesson.max}
                step={lesson.step}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <input
              className="lesson-input-slider"
              type="range"
              aria-label="Adjust lesson input"
              min={lesson.min}
              max={lesson.max}
              step={lesson.step}
              value={Number.isFinite(Number(value)) && value !== '' ? value : lesson.min}
              onChange={(event) => setValue(event.target.value)}
            />
            <div className="lesson-range-labels">
              <span>
                {lesson.min} {lesson.unit}
              </span>
              <span>
                {lesson.max} {lesson.unit}
              </span>
            </div>
            <div className="lesson-presets">
              <button
                type="button"
                onClick={() => setValue(lesson.initial)}
                aria-label="Reset input"
              >
                <span>Starting input</span>
                <strong>
                  {lesson.initial} {lesson.unit}
                </strong>
              </button>
              <button
                type="button"
                onClick={() => setValue(lesson.challenge)}
                aria-label="Try the challenge value"
              >
                <span>Try the challenge value</span>
                <strong>
                  {lesson.challenge} {lesson.unit}
                </strong>
              </button>
            </div>
            <div className="lesson-step-heading">
              <b>02</b>
              <span>Predict, then test</span>
              <small>Optional</small>
            </div>
            <label className="lesson-prediction-label">
              Your prediction ({lesson.resultUnit})
              <input
                type="number"
                step="any"
                value={prediction}
                placeholder="What do you expect?"
                onChange={(event) => setPrediction(event.target.value)}
              />
            </label>
            <button className="lesson-run-button" type="submit" disabled={busy}>
              {busy ? 'Calculating…' : 'Run lesson'} <span aria-hidden="true">↗</span>
            </button>
          </form>
          {busy && (
            <p role="status" className="lesson-status">
              Calculating lesson…
            </p>
          )}
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          {dirty && <p className="notice">Input changed. Run the lesson to update the result.</p>}
          {!busy && completed && (
            <div
              className="course-result lesson-result-card"
              data-testid="lesson-result"
              aria-live="polite"
            >
              <span className="eyebrow">03 / OBSERVE THE RESULT</span>
              <span>
                Result for {usedValue} {lesson.unit}
              </span>
              <strong>
                {noGeneration
                  ? 'No generator-running interval'
                  : noDepletion && Number(run?.scenario.battery_initial_kwh) === 0
                    ? 'Battery starts empty'
                    : shown(result)}
              </strong>
              {result !== undefined && result !== null && (
                <span className="lesson-result-unit">{lesson.resultUnit}</span>
              )}
              {noDepletion && (
                <p>
                  No positive-to-zero depletion event was recorded. Inspect the opening reserve and
                  unserved energy.
                </p>
              )}
              {noGeneration && (
                <p>
                  Startup was scheduled for {300 + Number(usedValue)} s. Utility recovery at 900 s
                  can occur before a generator-running interval.
                </p>
              )}
              {id === 'distribution-loss' && run && (
                <p>
                  Source power required to meet demand:{' '}
                  {n(
                    Number(run.scenario.it_demand_kw) /
                      Number(run.scenario.distribution_efficiency),
                    6,
                  )}{' '}
                  kW. The headline value is actual grid energy over 30 minutes.
                </p>
              )}
              {reference && usedValue !== lesson.initial && (
                <p className="lesson-reference" data-testid="lesson-reference">
                  Starting input: {shown(reference.result)}{' '}
                  {reference.result !== undefined && lesson.resultUnit}
                </p>
              )}
              {comparable && (
                <p className="lesson-prediction-feedback" data-testid="prediction-feedback">
                  Your prediction: {n(prediction, 6)} {lesson.resultUnit}. Difference from result:{' '}
                  {n(Math.abs(Number(result) - Number(prediction)), 6)} {lesson.resultUnit}.
                </p>
              )}
              {run && (
                <div className="lesson-checks">
                  <span>
                    Unserved energy <b>{n(run.summary.unserved_it_kwh, 6)} kWh</b>
                  </span>
                  <span>
                    Energy balance residual <b>{run.summary.energy_balance_residual_kwh} kWh</b>
                  </span>
                </div>
              )}
              {planning && (
                <div className="lesson-checks">
                  <span>
                    IT energy <b>{n(planning.it_energy_kwh, 0)} kWh</b>
                  </span>
                  <span>
                    Non-IT energy <b>{n(planning.non_it_energy_kwh, 0)} kWh</b>
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      <section className="lesson-understanding" aria-label="Understand and continue">
        <div className="lesson-answer">
          <span className="eyebrow">CONNECT THE RESULT TO THE REASONING</span>
          <h3>What changed, and why?</h3>
          <p>
            The worked answer explains the starting input and challenge. Explore other values in the
            same bounded model.
          </p>
          <button
            className="answer-button"
            aria-expanded={answer}
            onClick={() => setAnswer(!answer)}
          >
            {answer ? 'Hide worked answer' : 'Show worked answer'}{' '}
            <span aria-hidden="true">{answer ? '−' : '+'}</span>
          </button>
          {answer && (
            <div className="worked-answer">
              <p>{lesson.explanation}</p>
              <small>
                Display values are rounded. Export the complete calculation for its full precision
                and input hash.
              </small>
            </div>
          )}
        </div>
        <div className="lesson-next">
          <span className="eyebrow">YOUR COURSE JOURNEY</span>
          <h3>{position === 11 ? 'Keep your next question.' : 'Carry the idea forward.'}</h3>
          <p>
            {position === 11
              ? 'You have reached lesson 12. Revisit an assumption, compare another value, or export a result for discussion.'
              : `Next: ${lessons[position + 1].title.replace(/^\d+\. /, '')}`}
          </p>
          <button
            className="lesson-review-toggle"
            aria-pressed={reviewed}
            onClick={() =>
              setReviewedIds((current) =>
                reviewed ? current.filter((item) => item !== id) : [...current, id],
              )
            }
          >
            {reviewed ? 'Marked as reviewed' : 'Mark as reviewed'}{' '}
            <span aria-hidden="true">{reviewed ? '✓' : '○'}</span>
          </button>
          <small>Self-marked in this visit only. Nothing is saved or sent.</small>
          <div className="lesson-paging">
            <button
              disabled={position === 0}
              onClick={() => chooseLesson(lessons[position - 1].id)}
            >
              Previous lesson
            </button>
            <button
              disabled={position === lessons.length - 1}
              onClick={() => chooseLesson(lessons[position + 1].id)}
            >
              Next lesson <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
      {completed && (
        <section className="lesson-evidence" aria-label="Reproduce this lesson">
          <div className="lesson-export-heading">
            <div>
              <span className="eyebrow">TAKE THE EVIDENCE WITH YOU</span>
              <h3>Your experiment, reproducible.</h3>
              <p>
                Save the completed inputs, results and hash. Exported data stays tied to the last
                run.
              </p>
            </div>
            {run && (
              <button onClick={() => download(run, `lesson-${lesson.id}-${run.run_id}.json`)}>
                Export lesson run <span aria-hidden="true">↗</span>
              </button>
            )}
            {planning && (
              <button onClick={() => download(planning, 'pue-lesson.json')}>
                Export PUE calculation <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
          {run && <RunTools run={run} />}
          <PythonVerification run={(run ?? planning)!} />
        </section>
      )}
      <details className="panel assumptions lesson-assumptions">
        <summary>Lesson assumptions and limits</summary>
        <p>
          These are original synthetic electrical and energy-planning exercises. Ratings, event
          times, storage and efficiencies are assumptions, not selected equipment or measurements
          from a facility.
        </p>
        <p>
          The 50 MW examples model aggregate requested IT power. They do not predict GPU jobs,
          cooling, grid adequacy, AC transients, protection, facility safety, reliability
          probabilities or certified uptime. The N+1 lesson examines a path-capacity condition only.
          PUE is a separate energy calculation.
        </p>
        <p>
          No physical controls or external telemetry are used. Independent external technical review
          has not yet been obtained. The animated objects illustrate the completed calculation;
          animation speed is not a controller response time.
        </p>
        <p>
          Worked answers describe the starting and challenge values. Other inputs may change the
          event sequence. All input hashes and limitations travel with exports. Review marks are
          temporary self-reports, not qualifications, scores or collected completion data.
        </p>
      </details>
    </div>
  );
}
