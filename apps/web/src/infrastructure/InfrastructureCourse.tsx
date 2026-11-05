import { requiredValue, requiredPresent } from '../required-value';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CurriculumTracks } from '../CurriculumTracks';
import { courseCatalog, courseTotal, lessonNavigation, navigateLesson } from '../curriculum';
import { useVisitReviews } from '../visit-reviews';
import { evidenceLabels, loadInfrastructureLesson, type InfrastructureLesson } from './content';
import { fuelEvidence, fuelInputs } from './fuel';
import {
  buildScreenResult,
  calculateScreen,
  canonicalHash,
  screenUnits,
  type InfrastructureScreenResult,
  type ScreenInputs,
  type ScreenOutputs,
} from './screens';
import './infrastructure.css';

const InfrastructureScene = lazy(() =>
  import('./scenes/Scene').then((m) => ({ default: m.InfrastructureScene })),
);
const titleFor = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const display = (value: ScreenOutputs[string]) =>
  value === null
    ? 'Not available in this model'
    : typeof value === 'number'
      ? new Intl.NumberFormat('en', { maximumSignificantDigits: 9 }).format(value)
      : Array.isArray(value)
        ? value.join(', ')
        : String(value).replaceAll('-', ' ');
type Draft = Record<string, string>;
const toDraft = (inputs: ScreenInputs): Draft =>
  Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(', ') : value === null ? 'infinite' : String(value),
    ]),
  );
function applied(draft: Draft): ScreenInputs {
  return Object.fromEntries(
    Object.entries(draft).map(([key, text]) => {
      if (text === 'infinite' && key === 'sourceMVA') return [key, null];
      const values = text.split(',').map((part) => {
        if (!part.trim()) throw new RangeError(`${titleFor(key)} is required.`);
        const value = Number(part);
        if (!Number.isFinite(value)) throw new RangeError(`${titleFor(key)} must be finite.`);
        return value;
      });
      return [
        key,
        key === 'stageSeconds'
          ? values
          : values.length === 1
            ? requiredValue(values[0], key)
            : (() => {
                throw new RangeError(`${titleFor(key)} requires one number.`);
              })(),
      ];
    }),
  );
}
function ResultTable({
  outputs,
  units,
  caption,
}: {
  outputs: ScreenOutputs;
  units: Readonly<Record<string, string>>;
  caption: string;
}) {
  return (
    <div className="infra-table-wrap">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Quantity</th>
            <th scope="col">Value</th>
            <th scope="col">Unit</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(outputs).map(([key, value]) => (
            <tr key={key}>
              <th scope="row">{titleFor(key)}</th>
              <td data-output={key}>{display(value)}</td>
              <td>{units[key] || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const criteria = [
  'capacity',
  'connectivity',
  'protection',
  'thermal',
  'controls',
  'evidence',
] as const;
type ReviewRow = { state: 'pass' | 'fail' | 'unresolved'; reason: string; source: string };
type Review = Record<(typeof criteria)[number], ReviewRow>;
const initialReview = (): Review =>
  Object.fromEntries(
    criteria.map((key) => [
      key,
      {
        state: 'unresolved',
        reason: 'Required project evidence has not been supplied.',
        source: 'DCIE-R1 chapter 12, PDF pp.54–58',
      },
    ]),
  ) as Review;
type Completed = {
  result: InfrastructureScreenResult;
  fuel: InfrastructureScreenResult | null;
  prediction: string;
  review: Review | null;
  exportHash: string;
};
function download(value: unknown, name: string, type = 'application/json') {
  const url = URL.createObjectURL(
    new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
export function InfrastructureCourse({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<InfrastructureLesson | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [fuelDraft, setFuelDraft] = useState<Draft>(() => toDraft(fuelInputs));
  const [completed, setCompleted] = useState<Completed | null>(null);
  const [prediction, setPrediction] = useState('');
  const [review, setReview] = useState<Review>(initialReview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const { reviewedIds, setReviewedIds } = useVisitReviews();
  useEffect(() => {
    let active = true;
    void loadInfrastructureLesson(lessonId)
      .then((value) => {
        if (active) {
          setLesson(value);
          setDraft(toDraft(value.experiment.defaultInputs));
        }
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [lessonId]);
  async function run() {
    if (!lesson) return;
    const requestId = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const inputs = applied(draft);
      const matrix = lessonId === 'integrated-design-release' ? structuredClone(review) : null;
      if (
        matrix &&
        criteria.some((key) => !matrix[key].reason.trim() || !matrix[key].source.trim())
      )
        throw new RangeError('Each review criterion requires a reason and a source locator.');
      const result = await buildScreenResult(
        lesson,
        inputs,
        import.meta.env.VITE_PUBLIC_SOURCE_REVISION || null,
      );
      const fuel =
        lessonId === 'generator-bank-fuel'
          ? await buildScreenResult(
              fuelEvidence(lesson),
              applied(fuelDraft),
              import.meta.env.VITE_PUBLIC_SOURCE_REVISION || null,
            )
          : null;
      const payload = { result, fuel, prediction, review: matrix };
      const exportHash = await canonicalHash(payload);
      if (requestId === generation.current) setCompleted({ ...payload, exportHash });
    } catch (cause) {
      if (requestId === generation.current) setError((cause as Error).message);
    } finally {
      if (requestId === generation.current) setBusy(false);
    }
  }
  if (!lesson)
    return (
      <p role={error ? 'alert' : 'status'}>
        {error || 'Loading Infrastructure Engineering lesson…'}
      </p>
    );
  const units = screenUnits(lesson.experiment.model);
  const current = requiredPresent(lessonNavigation(lessonId), 'lessonNavigation(lessonId)');
  const previous = courseCatalog[current.number - 2];
  const next = courseCatalog[current.number];
  const dirty =
    completed !== null &&
    (JSON.stringify(toDraft(completed.result.inputs)) !== JSON.stringify(draft) ||
      (completed.fuel !== null &&
        JSON.stringify(toDraft(completed.fuel.inputs)) !== JSON.stringify(fuelDraft)) ||
      prediction !== completed.prediction ||
      (completed.review !== null && JSON.stringify(review) !== JSON.stringify(completed.review)));
  const reviewed = reviewedIds.includes(lessonId);
  const envelope = completed
    ? {
        exportSchema: 'infrastructure-lesson-export-1',
        ...completed,
        engineeringDecision: 'HOLD',
        independentEngineeringVerification: false,
      }
    : null;
  return (
    <div
      className="infrastructure-course"
      data-testid="infrastructure-course"
      data-lesson={lessonId}
    >
      <CurriculumTracks activeTrack="infrastructure" />
      <nav className="infra-lesson-nav" aria-label="Infrastructure lessons">
        {courseCatalog
          .filter((item) => item.renderer === 'infrastructure')
          .map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigateLesson(item.id);
              }}
              aria-current={item.id === lessonId ? 'page' : undefined}
            >
              {item.number}
              <span>{item.title}</span>
            </button>
          ))}
      </nav>
      <section className="infra-intro" aria-labelledby="infra-title">
        <div className="eyebrow">
          Infrastructure Engineering · Lesson {lesson.number} / {courseTotal} ·{' '}
          {lesson.estimatedMinutes} minutes
        </div>
        <h2 id="infra-title">{lesson.title}</h2>
        <p>{lesson.lead}</p>
        <ul>
          {lesson.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </section>
      <aside className="infra-hold">
        <strong>Engineering HOLD — educational screens only.</strong>
        <p>
          Passing a calculation does not certify an installation. Source claims, illustrative
          assumptions and unresolved project evidence stay visible. Original adaptation of DCIE-R1;
          educational publication approved by the owner on 12 October 2026.
        </p>
      </aside>
      <div className="infra-studio">
        <div>
          <Suspense
            fallback={
              <div className="infra-scene-loading" role="status">
                Loading the lesson scene…
              </div>
            }
          >
            <InfrastructureScene
              lessonId={lessonId}
              title={lesson.scene.title}
              storyboard={lesson.scene.storyboard}
              staticAlternative={lesson.scene.staticAlternative}
              result={completed?.result ?? null}
              fuelResult={completed?.fuel ?? null}
            />
          </Suspense>
          <p className="infra-scene-context">{lesson.scene.interaction}</p>
        </div>
        <section className="infra-panel" aria-label="Infrastructure experiment">
          <span className="eyebrow">Predict → run → explain</span>
          <h3>Your declared assumptions</h3>
          <p>
            Each input belongs to the labelled model boundary. Run explicitly; scenes and exports
            retain the completed case.
          </p>
          <ol>
            {lesson.experiment.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
          >
            <div className="infra-inputs">
              {Object.entries(draft).map(([key, value]) => (
                <label key={key}>
                  {titleFor(key)}
                  {units.inputs[key] ? ` (${units.inputs[key]})` : ''}
                  {key === 'sourceMVA' && (
                    <span className="infra-infinite">
                      <input
                        type="checkbox"
                        checked={value === 'infinite'}
                        onChange={(event) => {
                          setDraft({ ...draft, [key]: event.target.checked ? 'infinite' : '250' });
                        }}
                      />
                      Use infinite source
                    </span>
                  )}
                  <input
                    aria-label={`${titleFor(key)}${units.inputs[key] ? ` (${units.inputs[key]})` : ''}`}
                    type={key === 'stageSeconds' ? 'text' : 'number'}
                    inputMode="decimal"
                    step="any"
                    min={key === 'pue' ? 1 : undefined}
                    required
                    disabled={value === 'infinite'}
                    value={value === 'infinite' ? '' : value}
                    onChange={(event) => {
                      setDraft({ ...draft, [key]: event.target.value });
                    }}
                  />
                  {key === 'stageSeconds' && (
                    <small>
                      Comma-separated physical durations: detection, start, qualification,
                      restoration (s).
                    </small>
                  )}
                </label>
              ))}
            </div>
            {lessonId === 'generator-bank-fuel' && (
              <fieldset>
                <legend>Separate usable-fuel ledger</legend>
                <p>
                  Source statement: constant load and the stated source-specific coefficient. Gross
                  tank volume, reserve and transfer capability remain unresolved.
                </p>
                <div className="infra-inputs">
                  {Object.entries(fuelDraft).map(([key, value]) => (
                    <label key={key}>
                      {titleFor(key)} ({screenUnits('fuelScreen').inputs[key]})
                      <input
                        aria-label={`Fuel ${titleFor(key)} (${String(screenUnits('fuelScreen').inputs[key])})`}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        required
                        value={value}
                        onChange={(event) => {
                          setFuelDraft({ ...fuelDraft, [key]: event.target.value });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="infra-prediction">
              Your prediction (optional)
              <textarea
                value={prediction}
                onChange={(event) => {
                  setPrediction(event.target.value);
                }}
                rows={2}
              />
            </label>
            {lessonId === 'integrated-design-release' && (
              <fieldset className="infra-review">
                <legend>Six independent evidence criteria</legend>
                <p>
                  Record a justified state for each criterion. These self-reports cannot clear the
                  manuscript's engineering HOLD.
                </p>
                {criteria.map((key) => (
                  <div key={key}>
                    <label>
                      {titleFor(key)} state
                      <select
                        value={review[key].state}
                        onChange={(event) => {
                          setReview({
                            ...review,
                            [key]: {
                              ...review[key],
                              state: event.target.value as ReviewRow['state'],
                            },
                          });
                        }}
                      >
                        <option value="unresolved">Unresolved</option>
                        <option value="fail">Fail</option>
                        <option value="pass">Pass — claimed, requires evidence</option>
                      </select>
                    </label>
                    <label>
                      {titleFor(key)} reason
                      <input
                        required
                        value={review[key].reason}
                        onChange={(event) => {
                          setReview({
                            ...review,
                            [key]: { ...review[key], reason: event.target.value },
                          });
                        }}
                      />
                    </label>
                    <label>
                      {titleFor(key)} source locator
                      <input
                        required
                        value={review[key].source}
                        onChange={(event) => {
                          setReview({
                            ...review,
                            [key]: { ...review[key], source: event.target.value },
                          });
                        }}
                      />
                    </label>
                  </div>
                ))}
              </fieldset>
            )}
            <div className="infra-actions">
              <button className="primary" disabled={busy} type="submit">
                {busy ? 'Calculating…' : 'Run screen'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(toDraft(lesson.experiment.defaultInputs));
                  setFuelDraft(toDraft(fuelInputs));
                }}
              >
                Reset inputs
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(
                    toDraft({
                      ...lesson.experiment.defaultInputs,
                      ...lesson.experiment.challenge.changes,
                    }),
                  );
                }}
              >
                Apply challenge
              </button>
            </div>
          </form>
          <p role="status" data-testid="infrastructure-run-state">
            {dirty
              ? 'Inputs changed — run to update. Exports keep the completed case.'
              : completed
                ? 'Completed case. Results, scene and export use the applied inputs.'
                : 'No completed result. The scene is an explanatory preview.'}
          </p>
          {error && <p role="alert">{error}</p>}
          {completed && (
            <ResultTable
              outputs={completed.result.outputs}
              units={completed.result.outputUnits}
              caption="Last completed educational screen"
            />
          )}
          {completed?.fuel && (
            <ResultTable
              outputs={completed.fuel.outputs}
              units={completed.fuel.outputUnits}
              caption="Last completed usable-fuel screen"
            />
          )}
        </section>
      </div>
      <section className="infra-panel" aria-label="Teaching prose">
        {lesson.sections.map((section) => (
          <article
            className="infra-evidence-block"
            key={section.title}
            data-evidence-label={section.evidenceLabel}
          >
            <span className="infra-source-label">{evidenceLabels[section.evidenceLabel]}</span>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
      <section className="infra-panel" aria-label="Worked default and challenge">
        <h3>Worked starting case</h3>
        <p>
          These values illustrate the supplied default assumptions. They are separate from your
          completed experiment.
        </p>
        <ResultTable
          outputs={calculateScreen(lesson.experiment.model, lesson.experiment.defaultInputs)}
          units={units.outputs}
          caption="Supplied default, unrounded values retained in exports"
        />
        <h3>Challenge</h3>
        <p>{lesson.experiment.challenge.question}</p>
        <pre>{JSON.stringify(lesson.experiment.challenge.changes, null, 2)}</pre>
        <details>
          <summary>Show challenge answer and criteria</summary>
          <p>{lesson.experiment.challenge.answer}</p>
        </details>
      </section>
      <section className="infra-panel" aria-label="Three lesson assessments">
        <h3>Explain the result</h3>
        <p>
          Three self-assessments. Answers and criteria support learning; no certification score is
          awarded.
        </p>
        {lesson.assessments.map((assessment) => (
          <article className="infra-assessment" key={assessment.id}>
            <h4>
              {assessment.id} · {assessment.question}
            </h4>
            <label>
              Your explanation
              <textarea rows={3} />
            </label>
            <details>
              <summary>Show answer and marking criterion</summary>
              <p>{assessment.answer}</p>
              <p>
                <strong>Criterion:</strong> {assessment.rubric}
              </p>
              <p>
                <strong>Locator:</strong> {assessment.source}
              </p>
            </details>
          </article>
        ))}
      </section>
      <section className="infra-panel" aria-label="Source boundaries and export">
        <h3>Source, assumptions and model limits</h3>
        <p>
          <cite>Data Centre Infrastructure Engineering</cite>, reference manuscript revision 1
          (DCIE-R1), chapter {lesson.source.chapter}, PDF pp.{lesson.source.pdfPages.join('–')}.
          Cover counts as PDF page 1. {lesson.source.evidenceStatus}.
        </p>
        <ul>
          {lesson.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <p>
          Separate result family: infrastructure-screen-1. Model/content versions, units and raw
          precision accompany applied inputs. Browser Python comparison is unavailable for this
          result family; development cross-checks are documented separately.
        </p>
        <div className="infra-actions">
          <a
            href={
              import.meta.env.MODE === 'demo'
                ? `./${lesson.readingRoute}`
                : `https://khanlab.co.technology/${lesson.readingRoute}`
            }
          >
            Read this lesson without JavaScript
          </a>
          {completed && (
            <button
              onClick={() => {
                download(
                  envelope,
                  `infrastructure-${lessonId}-${completed.result.inputHash.slice(0, 12)}.json`,
                );
              }}
            >
              Export completed screen
            </button>
          )}
        </div>
        {completed && (
          <details>
            <summary>Inspect applied inputs and hashes</summary>
            <pre>{JSON.stringify(envelope, null, 2)}</pre>
          </details>
        )}
      </section>
      <nav className="infra-prerequisites" aria-label="Related lessons">
        <strong>Build on:</strong>
        {lesson.prerequisites.map((id) => (
          <a key={id} href={`?lesson=${encodeURIComponent(id)}`}>
            {lessonNavigation(id)?.title || id}
          </a>
        ))}
      </nav>
      <div className="infra-actions infra-pager">
        {previous && (
          <button
            onClick={() => {
              navigateLesson(previous.id);
            }}
          >
            Previous lesson · {previous.number}
          </button>
        )}
        <button
          aria-pressed={reviewed}
          onClick={() => {
            setReviewedIds((ids) =>
              reviewed ? ids.filter((id) => id !== lessonId) : [...ids, lessonId],
            );
          }}
        >
          {reviewed ? 'Marked as reviewed' : 'Mark as reviewed'}
        </button>
        {next ? (
          <button
            onClick={() => {
              navigateLesson(next.id);
            }}
          >
            Next lesson · {next.number}
          </button>
        ) : (
          <a href="?mode=emt">Continue to EMT &amp; dynamics</a>
        )}
      </div>
      <p className="infra-privacy">
        Review marks are self-reported in this visit only. Nothing is saved or sent.{' '}
        {next
          ? ''
          : `You have reached the end of ${String(courseTotal)} lessons; engineering evidence remains open.`}
      </p>
    </div>
  );
}
