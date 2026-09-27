import { useEffect, useId, useRef, useState } from 'react';
import type { SiteScenario } from './types';
import { n } from './client';
import {
  demandDraft,
  demandPreview,
  nextStepTime,
  scenarioWithDemand,
  type DemandStep,
} from './demand-timeline';
import { decimalText } from './js-engine/decimal';
import { parseQuantity } from './js-engine/contract';
import './demand-timeline.css';

function powerRange(scenario: SiteScenario) {
  return Math.min(
    1e12,
    Math.max(
      1,
      Number(scenario.it_demand_kw),
      ...scenario.events
        .filter((event) => event.action === 'set_demand')
        .map((event) => Number(event.value_kw)),
    ) * 2,
  );
}

type DemandTimelineProps = {
  current: SiteScenario;
  busy: boolean;
  onRun: (scenario: SiteScenario) => void;
};

export function DemandTimeline(props: DemandTimelineProps) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const heading = container.current?.querySelector('h2');
    heading?.focus({ preventScroll: true });
    container.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, []);
  // A preset/import can replace event slots before an effect runs. Start a new
  // editor atomically so old step identifiers never touch a different scenario.
  return (
    <div ref={container}>
      <TimelineEditor key={JSON.stringify(props.current)} {...props} />
    </div>
  );
}

function TimelineEditor({ current, busy, onRun }: DemandTimelineProps) {
  const [draft, setDraft] = useState(() => demandDraft(current));
  const [selected, setSelected] = useState('initial');
  const [notice, setNotice] = useState('');
  const [rangeMax, setRangeMax] = useState(() => powerRange(current));
  const [plotWidth, setPlotWidth] = useState(900);
  const plotElement = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const firstRender = useRef(true);
  const titleId = useId();
  const hintId = useId();
  useEffect(() => {
    setDraft(demandDraft(current));
    setSelected('initial');
    setRangeMax(powerRange(current));
    if (!firstRender.current) setNotice('Timeline synchronized with the current scenario.');
    firstRender.current = false;
  }, [current]);

  let scenario: SiteScenario | null = null;
  let error = '';
  try {
    scenario = scenarioWithDemand(current, draft);
  } catch (problem) {
    error = (problem as Error).message;
  }
  const preview = scenario ? demandPreview(scenario) : null;
  const hasPreview = preview !== null;
  useEffect(() => {
    if (!plotElement.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setPlotWidth(Math.max(240, entry.contentRect.width));
    });
    observer.observe(plotElement.current);
    return () => observer.disconnect();
  }, [hasPreview]);
  const otherEvents = current.events.filter((event) => event.action !== 'set_demand');
  const selectedIndex = draft.steps.findIndex((step) => step.id === selected);
  const selectedStep = draft.steps[selectedIndex];
  const selectedKw = selectedStep?.demandKw ?? draft.initialKw;
  const validatedSteps = scenario?.events.filter((event) => event.action === 'set_demand') ?? [];
  const sliderKw =
    Number(selectedStep ? validatedSteps[selectedIndex]?.value_kw : scenario?.it_demand_kw) || 0;
  const ymax =
    Math.max(
      1,
      Number(scenario?.it_demand_kw || 0),
      ...(scenario?.events
        .filter((event) => event.action === 'set_demand')
        .map((event) => Number(event.value_kw)) ?? []),
    ) * 1.2;
  const width = plotWidth,
    height = 280,
    left = width < 500 ? 52 : 80,
    top = 25,
    bottom = 233,
    right = width - 25;
  const x = (at: number) => left + (at / current.duration_s) * (right - left);
  const y = (kw: string | number) => bottom - (Number(kw) / ymax) * (bottom - top);
  const path = preview?.segments
    .map(
      (segment, index) =>
        `${index ? 'L' : 'M'}${x(segment.start)},${y(segment.kw)} H${x(segment.end)}`,
    )
    .join(' ');
  const changed = JSON.stringify(draft) !== JSON.stringify(demandDraft(current));

  function updateStep(id: string, values: Partial<DemandStep>) {
    setDraft((value) => ({
      ...value,
      steps: value.steps.map((step) => (step.id === id ? { ...step, ...values } : step)),
    }));
    setNotice('');
  }
  function updatePower(value: string, typed = false) {
    if (typed) {
      try {
        const numericPower = Number(decimalText(parseQuantity(value)));
        setRangeMax((previous) => Math.min(1e12, Math.max(previous, numericPower * 2)));
      } catch {
        /* Invalid text remains editable; it cannot be run. */
      }
    }
    if (selectedStep) updateStep(selected, { demandKw: value });
    else setDraft({ ...draft, initialKw: value });
  }
  function addStep() {
    const id = `new-${nextId.current++}`;
    setDraft({
      ...draft,
      steps: [
        ...draft.steps,
        {
          id,
          originalIndex: null,
          atS: String(nextStepTime(draft, current.duration_s)),
          demandKw: draft.initialKw,
        },
      ],
    });
    setSelected(id);
    setNotice('Step added. Select its time and demand, then run the edited timeline.');
  }

  return (
    <section className="panel demand-editor" id="demand-timeline" aria-labelledby={titleId}>
      <div className="demand-editor-heading">
        <div>
          <span className="eyebrow">COMPOSE / COMPARE / EXPLAIN</span>
          <h2 id={titleId} tabIndex={-1}>
            Demand timeline
          </h2>
          <p>Shape a load profile, then see whether the supply can follow it.</p>
        </div>
        <div className="demand-preview-total">
          <span>Requested IT energy · preview</span>
          <strong data-testid="demand-preview-energy">
            {preview ? `${n(preview.requestedKwh, 3)} kWh` : 'Check inputs'}
          </strong>
        </div>
      </div>
      <p id={hintId} className="demand-editor-hint">
        Select a numbered point or a step below. Sliders use whole seconds and kW; the fields accept
        exact decimal kW. Results and exports stay on the last completed run until you run these
        edits.
      </p>
      {preview && scenario && (
        <div className="demand-plot" ref={plotElement}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Preview of requested IT demand in kilowatts over elapsed seconds"
          >
            <title>Requested demand steps, before supply is simulated</title>
            {[0, 0.5, 1].map((fraction) => (
              <g key={fraction}>
                <line
                  className="demand-grid"
                  x1={left}
                  x2={right}
                  y1={y(fraction * ymax)}
                  y2={y(fraction * ymax)}
                />
                <text x={left - 9} y={y(fraction * ymax) + 5} textAnchor="end">
                  {new Intl.NumberFormat('en', {
                    notation: 'compact',
                    maximumSignificantDigits: 3,
                  }).format(fraction * ymax)}
                </text>
              </g>
            ))}
            <text x={left} y={15}>
              IT demand (kW)
            </text>
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <text
                key={fraction}
                x={x(fraction * current.duration_s)}
                y={bottom + 21}
                textAnchor={fraction === 1 ? 'end' : 'middle'}
              >
                {n(fraction * current.duration_s, 2)}
              </text>
            ))}
            <text x={(left + right) / 2} y={height - 2} textAnchor="middle">
              Elapsed seconds
            </text>
            {otherEvents.map((event, index) => (
              <line
                key={index}
                className="demand-event"
                x1={x(event.at_s)}
                x2={x(event.at_s)}
                y1={top}
                y2={bottom}
              />
            ))}
            <path className="demand-area" d={`${path} L${right},${bottom} L${left},${bottom} Z`} />
            <path className="demand-line" d={path} />
          </svg>
          {[
            { id: 'initial', atS: '0', demandKw: scenario.it_demand_kw },
            ...draft.steps.map((step, index) => ({
              ...step,
              demandKw: validatedSteps[index].value_kw!,
            })),
          ].map((step, index) => (
            <button
              key={step.id}
              type="button"
              disabled={busy}
              className="demand-point"
              aria-label={index === 0 ? 'Select initial demand' : `Select step ${index}`}
              aria-pressed={selected === step.id}
              style={{
                left: `${(x(Number(step.atS)) / width) * 100}%`,
                top: `${(y(step.demandKw) / height) * 100}%`,
              }}
              onClick={() => setSelected(step.id)}
            >
              {index === 0 ? 'I' : index}
            </button>
          ))}
        </div>
      )}
      <p className="demand-legend">
        <span>Blue: requested load</span>
        <span>Dashed amber: existing failure / recovery events</span>
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (scenario && !busy) onRun(scenario);
        }}
      >
        <fieldset disabled={busy} className="demand-edit-controls">
          <legend>Selected point</legend>
          <label>
            Point
            <select
              aria-label="Timeline point"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="initial">Initial demand</option>
              {draft.steps.map((step, index) => (
                <option key={step.id} value={step.id}>
                  Step {index + 1} · {step.atS} s
                </option>
              ))}
            </select>
          </label>
          <label>
            Demand (kW)
            <input
              aria-label="Selected demand (kW)"
              type="text"
              inputMode="decimal"
              maxLength={128}
              value={selectedKw}
              onChange={(event) => updatePower(event.target.value, true)}
              aria-describedby={hintId}
            />
          </label>
          {selectedStep && (
            <label>
              Time (s)
              <input
                aria-label="Selected time (seconds)"
                type="text"
                inputMode="numeric"
                maxLength={20}
                value={selectedStep.atS}
                onChange={(event) => updateStep(selected, { atS: event.target.value })}
              />
            </label>
          )}
          <label className="demand-slider">
            Adjust demand · whole kW
            <input
              aria-label="Adjust demand (whole kW)"
              type="range"
              min={0}
              max={Math.ceil(rangeMax)}
              step={1}
              disabled={!preview}
              value={sliderKw}
              onChange={(event) => updatePower(event.target.value)}
            />
          </label>
          {selectedStep && (
            <label className="demand-slider">
              Move step · seconds
              <input
                aria-label="Move step (seconds)"
                type="range"
                min={0}
                max={current.duration_s - 1}
                step={1}
                disabled={!preview}
                value={Number(selectedStep.atS) || 0}
                onChange={(event) => updateStep(selected, { atS: event.target.value })}
              />
            </label>
          )}
        </fieldset>
        <div className="demand-step-list" role="group" aria-label="Demand steps in event order">
          <button
            type="button"
            disabled={busy}
            aria-pressed={selected === 'initial'}
            onClick={() => setSelected('initial')}
          >
            Initial · {draft.initialKw} kW
          </button>
          {draft.steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              disabled={busy}
              aria-pressed={selected === step.id}
              onClick={() => setSelected(step.id)}
            >
              Step {index + 1} · {step.atS} s · {step.demandKw} kW
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="error-banner">
            {error} Correct the inputs before running; the previous result is unchanged.
          </p>
        )}
        <div className="demand-editor-actions">
          <button
            type="button"
            disabled={busy || otherEvents.length + draft.steps.length >= 128}
            onClick={addStep}
          >
            Add demand step
          </button>
          <button
            type="button"
            disabled={busy || !selectedStep}
            onClick={() => {
              setDraft({ ...draft, steps: draft.steps.filter((step) => step.id !== selected) });
              setSelected('initial');
              setNotice('Step removed from the preview.');
            }}
          >
            Remove selected step
          </button>
          <button
            type="button"
            disabled={busy || !changed}
            onClick={() => {
              setDraft(demandDraft(current));
              setSelected('initial');
              setNotice('Draft edits discarded.');
            }}
          >
            Reset timeline edits
          </button>
          <button type="submit" className="primary" disabled={busy || !scenario}>
            {busy ? 'Calculating…' : 'Run edited timeline'}
          </button>
        </div>
        <p role="status" className="demand-editor-state">
          {notice}{' '}
          {changed
            ? 'Preview edits are not yet in the completed run.'
            : 'Timeline matches the current scenario inputs.'}
        </p>
      </form>
      <details className="demand-event-details">
        <summary>Schedule rules and {otherEvents.length} preserved availability events</summary>
        <p>
          Each step holds until the next one. Times are whole seconds from 0 to{' '}
          {current.duration_s - 1}. At the same time, the last listed demand step wins; a step at 0
          overrides the initial demand immediately. Up to 128 total events are supported. Editing
          demand preserves all asset, domain, failure and recovery settings.
        </p>
        {otherEvents.length > 0 && (
          <ul>
            {otherEvents.map((event, index) => (
              <li key={index}>
                {event.at_s} s · {event.action} · {event.target}
              </li>
            ))}
          </ul>
        )}
        <p>
          This is an explicit aggregate electrical load experiment. The preview integrates requested
          kW × time; it does not predict delivered power, GPU jobs, voltage or subsecond transients.
          Use the completed run for supply, storage and energy accounting. Changing a preset or
          another scenario input resets this local editor to those inputs.
        </p>
      </details>
    </section>
  );
}
