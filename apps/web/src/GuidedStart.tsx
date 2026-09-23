import { useEffect, useRef, useState, type FormEvent } from 'react';
import { lessons, lessonScenario } from './course-lessons';
import { n, request } from './client';
import { PythonVerification } from './PythonVerification';
import { RunTools } from './RunTools';
import type { Run, SiteScenario } from './types';
import './guided-start.css';

const lesson = lessons.find((item) => item.id === 'ride-through')!;
const outageAt = 300;
const recoveryAt = 900;

type GuidedStartProps = {
  onExplore: () => void;
  onLearn: () => void;
  onEvidence: () => void;
};

function format(value: number, digits = 3) {
  return Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: digits })
    : 'Unknown';
}

function downloadRun(run: Run) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `guided-ride-through-${run.run_id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PhaseDiagram() {
  return (
    <figure className="guided-diagram" aria-label="Three moments in the synthetic power scenario">
      <div className="guided-phases">
        <article className="guided-phase">
          <span className="guided-phase-index">01 / BEFORE</span>
          <svg viewBox="0 0 360 92" aria-hidden="true" focusable="false">
            <defs>
              <marker
                id="guided-arrow-before"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <rect
              className="guided-node guided-node-source"
              x="5"
              y="28"
              width="92"
              height="38"
              rx="8"
            />
            <text x="51" y="51" textAnchor="middle">
              UTILITY
            </text>
            <path className="guided-flow" d="M101 47 H128" markerEnd="url(#guided-arrow-before)" />
            <rect className="guided-node" x="135" y="28" width="92" height="38" rx="8" />
            <text x="181" y="51" textAnchor="middle">
              PATH · 95%
            </text>
            <path className="guided-flow" d="M231 47 H258" markerEnd="url(#guided-arrow-before)" />
            <rect
              className="guided-node guided-node-load"
              x="265"
              y="28"
              width="90"
              height="38"
              rx="8"
            />
            <text x="310" y="51" textAnchor="middle">
              IT · 1 MW
            </text>
          </svg>
          <p>Utility serves the steady IT load. The battery opens with stored energy.</p>
        </article>

        <article className="guided-phase guided-phase-outage">
          <span className="guided-phase-index">02 / OUTAGE · 300 s</span>
          <svg viewBox="0 0 360 92" aria-hidden="true" focusable="false">
            <defs>
              <marker
                id="guided-arrow-outage"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <rect
              className="guided-node guided-node-down"
              x="5"
              y="5"
              width="92"
              height="32"
              rx="8"
            />
            <text x="51" y="25" textAnchor="middle">
              UTILITY · OFF
            </text>
            <path className="guided-muted-flow" d="M101 21 H128" />
            <rect
              className="guided-node guided-node-battery"
              x="5"
              y="53"
              width="92"
              height="32"
              rx="8"
            />
            <text x="51" y="73" textAnchor="middle">
              BATTERY
            </text>
            <path
              className="guided-flow guided-battery-flow"
              d="M101 69 H128 V48"
              markerEnd="url(#guided-arrow-outage)"
            />
            <rect className="guided-node" x="135" y="28" width="92" height="38" rx="8" />
            <text x="181" y="51" textAnchor="middle">
              PATH · 95%
            </text>
            <path
              className="guided-flow guided-battery-flow"
              d="M231 47 H258"
              markerEnd="url(#guided-arrow-outage)"
            />
            <rect
              className="guided-node guided-node-load"
              x="265"
              y="28"
              width="90"
              height="38"
              rx="8"
            />
            <text x="310" y="51" textAnchor="middle">
              IT · 1 MW
            </text>
          </svg>
          <p>Generator is failed; charging is off. When reserve empties, demand is unserved.</p>
        </article>

        <article className="guided-phase guided-phase-recovery">
          <span className="guided-phase-index">03 / RECOVERY · 900 s</span>
          <svg viewBox="0 0 360 92" aria-hidden="true" focusable="false">
            <defs>
              <marker
                id="guided-arrow-after"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <rect
              className="guided-node guided-node-source"
              x="5"
              y="28"
              width="92"
              height="38"
              rx="8"
            />
            <text x="51" y="51" textAnchor="middle">
              UTILITY · ON
            </text>
            <path className="guided-flow" d="M101 47 H128" markerEnd="url(#guided-arrow-after)" />
            <rect className="guided-node" x="135" y="28" width="92" height="38" rx="8" />
            <text x="181" y="51" textAnchor="middle">
              PATH · 95%
            </text>
            <path className="guided-flow" d="M231 47 H258" markerEnd="url(#guided-arrow-after)" />
            <rect
              className="guided-node guided-node-load"
              x="265"
              y="28"
              width="90"
              height="38"
              rx="8"
            />
            <text x="310" y="51" textAnchor="middle">
              IT · 1 MW
            </text>
          </svg>
          <p>Utility returns at 900 s and serves the load again.</p>
        </article>
      </div>
      <figcaption>
        A small electrical boundary: utility → distribution → IT load, with stored battery energy
        bridging the outage.
      </figcaption>
    </figure>
  );
}

function outageLedger(run: Run) {
  const rows = run.intervals.filter(
    (row) => Number(row.start_s) >= outageAt && Number(row.end_s) <= recoveryAt,
  );
  const sum = (key: string) => rows.reduce((total, row) => total + Number(row.energy[key] ?? 0), 0);
  return {
    requested: sum('requested_it_kwh'),
    served: sum('served_it_kwh'),
    unserved: sum('unserved_it_kwh'),
  };
}

export function GuidedStart({ onExplore, onLearn, onEvidence }: GuidedStartProps) {
  const [reserve, setReserve] = useState<'100' | '50'>('100');
  const [prediction, setPrediction] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [predictionAtRun, setPredictionAtRun] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  function revise(next: () => void) {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    next();
    setRun(null);
    setPredictionAtRun('');
    setError('');
    setNotice('');
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const parsedPrediction = Number(prediction);
    if (!prediction.trim() || !Number.isFinite(parsedPrediction) || parsedPrediction < 0) {
      setError('Enter a prediction of 0 seconds or more, measured from the outage at 300 seconds.');
      return;
    }

    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setRun(null);
    setBusy(true);
    setNotice('Running the 1 MW synthetic scenario…');
    try {
      const base = await request<SiteScenario>(`demo?preset=${lesson.preset}`, controller.signal);
      const scenario = lessonScenario(lesson, base, reserve);
      const result = await request<Run>('simulations', controller.signal, scenario);
      if (controller.signal.aborted) return;
      setRun(result);
      setPredictionAtRun(prediction);
      const depletion = result.events.find((event) => event.action === 'battery_depleted');
      setNotice(
        depletion
          ? `Run complete. Battery ride-through is ${format(Number(depletion.at_s) - outageAt)} seconds from the outage. Compare your prediction below.`
          : 'Run complete. Compare your outage-relative prediction with the calculated result.',
      );
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError((cause as Error).message || 'The scenario could not be run. Try again.');
        setNotice('');
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function cancel() {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setNotice('Run cancelled. No result was produced.');
  }

  const depletion = run?.events.find((item) => item.action === 'battery_depleted');
  const elapsed = depletion ? Number(depletion.at_s) : null;
  const rideThrough = elapsed === null ? null : elapsed - outageAt;
  const ledger = run ? outageLedger(run) : null;
  const predictionDifference = rideThrough === null ? null : rideThrough - Number(predictionAtRun);

  return (
    <div className="guided-start">
      <header className="guided-hero">
        <div className="guided-hero-copy">
          <span className="guided-eyebrow">DATACENTER TWIN LAB · FIRST VISIT</span>
          <h2>Five minutes to reason it through.</h2>
          <p>
            One outage. One battery. Predict the reserve's runway, run the 1 MW lesson scenario,
            then follow the energy ledger.
          </p>
        </div>
        <div className="guided-hero-stamp" aria-label="Scenario scale and duration">
          <strong>1 MW</strong>
          <span>AGGREGATE IT LOAD</span>
          <span>5 MIN WALKTHROUGH</span>
        </div>
      </header>

      <ol className="guided-steps" aria-label="Walkthrough steps">
        <li className={run ? 'is-complete' : 'is-current'} aria-current={run ? undefined : 'step'}>
          <span className="guided-step-number">01</span>
          <span>
            <strong>Predict</strong>
            <small>Estimate seconds from outage</small>
          </span>
        </li>
        <li className={run ? 'is-complete' : ''}>
          <span className="guided-step-number">02</span>
          <span>
            <strong>Run</strong>
            <small>Calculate the scenario</small>
          </span>
        </li>
        <li className={run ? 'is-current' : ''} aria-current={run ? 'step' : undefined}>
          <span className="guided-step-number">03</span>
          <span>
            <strong>Explain</strong>
            <small>Trace energy and limits</small>
          </span>
        </li>
      </ol>

      <div className="guided-context-grid">
        <section className="guided-context" aria-labelledby="guided-scenario-title">
          <div className="guided-section-heading">
            <div>
              <span className="guided-eyebrow">THE SETUP</span>
              <h2 id="guided-scenario-title">A short continuity question</h2>
            </div>
            <span className="guided-reference-tag">REFERENCE CASE · SYNTHETIC</span>
          </div>
          <PhaseDiagram />
          <div className="guided-assumptions" aria-label="Scenario assumptions">
            <span>
              <strong>1,000 kW</strong> requested IT
            </span>
            <span>
              <strong>0.90</strong> battery discharge efficiency
            </span>
            <span>
              <strong>0.95</strong> distribution efficiency
            </span>
            <span>
              <strong>300 s</strong> outage begins
            </span>
            <span>
              <strong>900 s</strong> utility recovers
            </span>
            <span>
              <strong>Failed</strong> generator · charging disabled
            </span>
          </div>
        </section>

        <section className="guided-lab" aria-labelledby="guided-predict-title" aria-busy={busy}>
          <span className="guided-eyebrow">01 / MAKE A PREDICTION</span>
          <h2 id="guided-predict-title">How long can the battery serve the load?</h2>
          <p className="guided-lab-intro">
            Predict ride-through <em>after</em> the outage begins. The event occurs at 300 s
            elapsed; include that distinction in your estimate.
          </p>

          <div className="guided-reserve-control" role="group" aria-label="Opening battery reserve">
            <button
              type="button"
              aria-pressed={reserve === '100'}
              onClick={() => revise(() => setReserve('100'))}
            >
              <strong>100 kWh</strong>
              <span>Starting example</span>
            </button>
            <button
              type="button"
              aria-pressed={reserve === '50'}
              onClick={() => revise(() => setReserve('50'))}
            >
              <strong>50 kWh</strong>
              <span>Half-reserve challenge</span>
            </button>
          </div>

          <form
            className="guided-prediction-form"
            noValidate
            onSubmit={(event) => void calculate(event)}
          >
            <label htmlFor="guided-prediction">
              Your ride-through prediction <span>(seconds from outage)</span>
            </label>
            <div className="guided-prediction-input">
              <input
                id="guided-prediction"
                data-testid="guide-prediction"
                aria-describedby="guided-prediction-help"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={prediction}
                onChange={(event) => revise(() => setPrediction(event.target.value))}
                placeholder="e.g. 300"
              />
              <span aria-hidden="true">s</span>
            </div>
            <small id="guided-prediction-help">
              Use seconds after the 300 s outage event, not the elapsed timestamp.
            </small>
            <div className="guided-run-actions">
              <button
                className="guided-run-button"
                data-testid="guide-run"
                type="submit"
                disabled={busy}
              >
                {busy ? 'Running scenario…' : 'Run 1 MW scenario'}
              </button>
              {busy && (
                <button type="button" onClick={cancel}>
                  Cancel run
                </button>
              )}
            </div>
          </form>
          {error && (
            <p className="guided-error" role="alert">
              {error}
            </p>
          )}
          <p className="guided-live-status" role="status" aria-live="polite" aria-atomic="true">
            {notice}
          </p>
          {!run && !busy && (
            <p className="guided-no-result">No calculation is shown until you choose Run.</p>
          )}
        </section>
      </div>

      {run && rideThrough !== null && elapsed !== null && ledger && (
        <section
          className="guided-explanation"
          aria-labelledby="guided-result-title"
          data-testid="guide-result"
        >
          <div className="guided-result-heading">
            <div>
              <span className="guided-eyebrow">02 / RUN · 03 / EXPLAIN</span>
              <h2 id="guided-result-title">
                The battery bridges {format(rideThrough, 1)} seconds of the outage.
              </h2>
              <p>
                You predicted {format(Number(predictionAtRun), 1)} s from outage. The calculated
                ride-through is {format(rideThrough, 1)} s.
                {predictionDifference !== null && (
                  <>
                    {' '}
                    Difference: {predictionDifference > 0 ? '+' : ''}
                    {format(predictionDifference, 1)} s (calculated minus predicted).
                  </>
                )}
              </p>
            </div>
            <div
              className="guided-result-number"
              aria-label={`Ride-through ${format(rideThrough, 1)} seconds from outage`}
            >
              <strong>{format(rideThrough, 1)}</strong>
              <span>SECONDS · FROM OUTAGE</span>
            </div>
          </div>

          <nav className="guided-result-links" aria-label="Result sections">
            <a href="#guided-ledger">Energy ledger ↓</a>
            <a href="#guided-output">Run output and verification ↓</a>
          </nav>

          <div
            className="guided-time-compare"
            aria-label="Ride-through and elapsed time comparison"
          >
            <div>
              <span>Outage begins</span>
              <strong>300 s elapsed</strong>
            </div>
            <span className="guided-time-plus" aria-hidden="true">
              +
            </span>
            <div>
              <span>Ride-through</span>
              <strong>{format(rideThrough, 1)} s</strong>
            </div>
            <span className="guided-time-equals" aria-hidden="true">
              =
            </span>
            <div className="guided-time-total">
              <span>Battery depletion</span>
              <strong>{format(elapsed, 1)} s elapsed</strong>
            </div>
          </div>

          <div className="guided-explain-grid">
            <section className="guided-equation" aria-labelledby="guided-equation-title">
              <span className="guided-eyebrow">WHY THAT DURATION?</span>
              <h3 id="guided-equation-title">Convert stored energy into delivered IT energy</h3>
              <p className="guided-equation-line">
                {reserve} kWh × 0.90 × 0.95 ÷ 1,000 kW × 3,600 s/h ={' '}
                <strong>{format(rideThrough, 1)} s</strong>
              </p>
              <p>
                The battery discharge efficiency and distribution efficiency both reduce the energy
                delivered to the IT load. Charging is disabled in this lesson.
              </p>
            </section>

            <section
              className="guided-ledger"
              id="guided-ledger"
              aria-labelledby="guided-ledger-title"
            >
              <span className="guided-eyebrow">OUTAGE WINDOW · 300–900 s</span>
              <h3 id="guided-ledger-title">Energy ledger</h3>
              <dl>
                <div>
                  <dt>IT energy requested</dt>
                  <dd>{format(ledger.requested)} kWh</dd>
                </div>
                <div>
                  <dt>IT energy served</dt>
                  <dd>{format(ledger.served)} kWh</dd>
                </div>
                <div>
                  <dt>IT energy unserved</dt>
                  <dd>{format(ledger.unserved)} kWh</dd>
                </div>
                <div>
                  <dt>Unserved time before recovery</dt>
                  <dd>{format(Number(run.summary.unserved_duration_s))} s</dd>
                </div>
              </dl>
              <p>
                Service resumes when the utility returns at 900 s. This is the result of these
                inputs.
              </p>
            </section>
          </div>

          <section
            className="guided-output"
            id="guided-output"
            aria-labelledby="guided-output-title"
          >
            <div>
              <span className="guided-eyebrow">REPRODUCIBLE RUN</span>
              <h3 id="guided-output-title">Keep the complete result</h3>
              <p>
                JSON includes the exact inputs, input hash, interval ledger, events, and model
                limitations.
              </p>
            </div>
            <button type="button" onClick={() => downloadRun(run)}>
              Export guided run (JSON)
            </button>
            <code>Input SHA-256 · {run.input_sha256}</code>
          </section>

          <PythonVerification run={run} />
          <details className="guided-more-tools">
            <summary>More report and sensitivity tools</summary>
            <p>Optional tools use this completed scenario and may take a moment to calculate.</p>
            <RunTools run={run} />
          </details>

          <section className="guided-next" aria-label="Choose where to go next">
            <article>
              <span className="guided-eyebrow">KEEP EXPLORING</span>
              <h3>Change the system assumptions</h3>
              <button type="button" onClick={onExplore}>
                Open advanced energy workspace →
              </button>
            </article>
            <article>
              <span className="guided-eyebrow">BUILD THE IDEA</span>
              <h3>Work through the course</h3>
              <button type="button" onClick={onLearn}>
                Continue to the 12-lesson course →
              </button>
            </article>
            <article>
              <span className="guided-eyebrow">TRACE THE INPUTS</span>
              <h3>Review sources and evidence</h3>
              <button type="button" onClick={onEvidence}>
                Inspect evidence and sources →
              </button>
            </article>
          </section>
          <p className="guided-bounds">
            This synthetic, uncalibrated example covers a single aggregate electrical load, finite
            battery energy, stated efficiencies, and scheduled utility events. It does not model
            cooling transients, workload queues, protection, reliability probabilities, facility
            safety, or live telemetry; it offers no facility calibration or real-time controls.
          </p>
        </section>
      )}
    </div>
  );
}

export default GuidedStart;
