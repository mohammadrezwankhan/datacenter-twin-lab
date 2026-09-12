import { useEffect, useRef, useState } from 'react';
import { lessons, lessonScenario } from './course-lessons';
import { n, request } from './client';
import type { Run, SiteScenario } from './types';
import { RunTools } from './RunTools';
import { PythonVerification } from './PythonVerification';

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

export function Course() {
  const route = new URLSearchParams(window.location.search).get('lesson');
  const [id, setId] = useState(lessons.some((item) => item.id === route) ? route! : lessons[0].id);
  const lesson = lessons.find((item) => item.id === id)!;
  const [value, setValue] = useState(lesson.initial);
  const [usedValue, setUsedValue] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState(false);
  const active = useRef<AbortController | null>(null);
  const position = lessons.indexOf(lesson);

  async function calculate(input: string) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      const base = await request<SiteScenario>(`demo?preset=${lesson.preset}`, controller.signal);
      const scenario = lessonScenario(lesson, base, input);
      if (lesson.id === 'pue') {
        const result = await request<Planning>('planning', controller.signal, {
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
        if (controller.signal.aborted) return;
        setPlanning(result);
        setRun(null);
      } else {
        const result = await request<Run>('simulations', controller.signal, scenario);
        if (controller.signal.aborted) return;
        setRun(result);
        setPlanning(null);
      }
      setUsedValue(input);
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
    setAnswer(false);
    void calculate(lesson.initial);
    const url = new URL(window.location.href);
    url.searchParams.set('lesson', lesson.id);
    window.history.replaceState(null, '', url);
    return () => active.current?.abort();
  }, [id]);

  const generatorId = run?.scenario.assets.find((asset) => asset.kind === 'generator')?.id;
  const eventValue =
    lesson.resultKey === 'depletion'
      ? run?.events.find((event) => event.action === 'battery_depleted')?.at_s
      : run?.intervals.find(
          (interval) => generatorId && interval.asset_states[generatorId] === 'running',
        )?.start_s;
  const result =
    planning?.facility_energy_kwh ??
    (['depletion', 'generator_ready'].includes(lesson.resultKey)
      ? eventValue
      : run?.summary[lesson.resultKey]);
  return (
    <div className="course" data-testid="course">
      <section className="panel course-navigation">
        <label>
          Choose a lesson
          <select value={id} onChange={(event) => setId(event.target.value)}>
            {lessons.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <p>
          Start with power and energy, then test failures, storage and AI-scale demand. Each lesson
          has one input to change and a worked answer. No installation or account.
        </p>
        <progress value={position + 1} max={lessons.length} aria-label="Lesson position" />
        <span>
          Lesson {position + 1} of {lessons.length}
        </span>
      </section>
      <section className="panel course-experiment" aria-label="Lesson experiment">
        <div className="eyebrow">{lesson.concept}</div>
        <h2>{lesson.title}</h2>
        <p className="course-question">{lesson.question}</p>
        <p>
          Predict the result for{' '}
          <strong>
            {lesson.challenge} {lesson.unit}
          </strong>{' '}
          before running the change.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void calculate(value);
          }}
        >
          <label>
            {lesson.label} {lesson.unit && `(${lesson.unit})`}
            <input
              type="number"
              value={value}
              min={lesson.min}
              max={lesson.max}
              step={lesson.step}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <div className="tool-actions">
            <button type="submit" disabled={busy}>
              Run lesson
            </button>
            <button type="button" onClick={() => setValue(lesson.challenge)}>
              Try the challenge value
            </button>
            <button type="button" onClick={() => setValue(lesson.initial)}>
              Reset input
            </button>
          </div>
        </form>
        {busy && <p role="status">Calculating lesson…</p>}
        {error && <p role="alert">{error}</p>}
        {usedValue && value !== usedValue && (
          <p className="notice">Input changed. Run the lesson to update the result.</p>
        )}
        {!busy && (run || planning) && (
          <div className="course-result" data-testid="lesson-result">
            <span>
              Result for {usedValue} {lesson.unit}
            </span>
            <strong>
              {result === undefined ? 'No event' : n(result, 6)}{' '}
              {result !== undefined && lesson.resultUnit}
            </strong>
            {run && (
              <p>
                Unserved energy: {n(run.summary.unserved_it_kwh, 6)} kWh · Energy balance residual:{' '}
                {run.summary.energy_balance_residual_kwh} kWh
              </p>
            )}
            {planning && (
              <p>
                IT energy: {n(planning.it_energy_kwh, 0)} kWh · Non-IT energy:{' '}
                {n(planning.non_it_energy_kwh, 0)} kWh
              </p>
            )}
          </div>
        )}
        <button className="answer-button" aria-expanded={answer} onClick={() => setAnswer(!answer)}>
          {answer ? 'Hide worked answer' : 'Show worked answer'}
        </button>
        {answer && <p className="worked-answer">{lesson.explanation}</p>}
        <div className="tool-actions lesson-paging">
          <button disabled={position === 0} onClick={() => setId(lessons[position - 1].id)}>
            Previous lesson
          </button>
          <button
            disabled={position === lessons.length - 1}
            onClick={() => setId(lessons[position + 1].id)}
          >
            Next lesson
          </button>
        </div>
      </section>
      {run && (
        <>
          <section className="panel">
            <button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }),
                );
                const link = document.createElement('a');
                link.href = url;
                link.download = `lesson-${lesson.id}-${run.run_id}.json`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Export lesson run
            </button>
          </section>
          <RunTools run={run} />
          <PythonVerification run={run} />
        </>
      )}
      {planning && (
        <>
          <section className="panel">
            <button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(planning, null, 2)], { type: 'application/json' }),
                );
                const link = document.createElement('a');
                link.href = url;
                link.download = 'pue-lesson.json';
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Export PUE calculation
            </button>
          </section>
          <PythonVerification run={planning} />
        </>
      )}
      <details className="panel assumptions">
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
          has not yet been obtained.
        </p>
        <p>
          Worked answers describe the default and challenge values. Other inputs may change the
          event sequence. All input hashes and limitations travel with exports. Lesson completion is
          not collected.
        </p>
      </details>
    </div>
  );
}
