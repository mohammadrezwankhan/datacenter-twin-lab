import { requiredValue } from '../../required-value';
import { useState } from 'react';
import type { SceneProps } from './types';
import { numberOutput } from './types';
import { Device, SceneDiagram } from './primitives';

export default function ResilienceScene({ result, step }: SceneProps) {
  const [reviewState, setReviewState] = useState('Normal');
  const rows = [
    { label: 'Available connected capacity', value: numberOutput(result, 'availableMW', 'MW', 2) },
    { label: 'Margin to required demand', value: numberOutput(result, 'marginMW', 'MW', 2) },
    { label: 'Usable capacity per unit', value: numberOutput(result, 'usableUnitMW', 'MW', 2) },
    {
      label: 'Elementary N+1 unit count',
      value: numberOutput(result, 'minimumNPlusOne', 'units', 0),
    },
  ];
  const inputs = result?.inputs ?? {};
  const installed =
    result && typeof inputs.installed === 'number' ? Math.min(10, inputs.installed) : 7;
  const unavailable =
    result && typeof inputs.unavailable === 'number' ? Math.min(installed, inputs.unavailable) : 0;
  const pathExplanation = [
    'One shared capacity bank feeds visibly separate A and B corridors.',
    'Only the completed input snapshot determines unavailable capacity.',
    'The dashed control edge marks a common dependency, outside both feeder paths.',
    'Capacity rows are arithmetic screens, not redundancy certification.',
  ][step];
  const units = (x: number, y: number, prefix: string) =>
    Array.from({ length: installed }, (_, index) => {
      const out = index < unavailable;
      return (
        <g key={`${prefix}-${String(index)}`} opacity={out ? '.38' : '1'}>
          <rect
            x={x + index * 31}
            y={y}
            width="24"
            height="34"
            rx="4"
            fill={out ? '#30282b' : '#1b3442'}
            stroke={out ? '#ff9e8b' : '#69d8d3'}
          />
          <text x={x + index * 31 + 12} y={y + 22} textAnchor="middle" fill="#edf4fa" fontSize="11">
            {index + 1}
          </text>
          {out && (
            <path
              d={`M${String(x + index * 31 + 4)} ${String(y + 29)}l16-24`}
              stroke="#ff9e8b"
              strokeWidth="2"
            />
          )}
        </g>
      );
    });
  return (
    <div className="infra-scene-composition">
      <div
        className="infra-scene-composition-controls"
        role="group"
        aria-label="Choose a resilience review state"
      >
        {['Normal', 'Maintenance', 'One-unit loss', 'Restoration'].map((state) => (
          <button
            type="button"
            key={state}
            aria-pressed={reviewState === state}
            onClick={() => {
              setReviewState(state);
            }}
          >
            {state}
          </button>
        ))}
      </div>
      <p className="infra-scene-local-note" role="status">
        {reviewState} review focus. This selector does not change the applied capacity result;
        change the declared inputs and run to recalculate. Current applied margin:{' '}
        {requiredValue(rows[1], 'rows[1]').value}.
      </p>
      <SceneDiagram
        id="resilience"
        title="Separate A/B capacity paths"
        description={`${String(pathExplanation)} Selected review focus: ${reviewState}; capacity remains bound to the completed run.`}
        rows={rows}
        flat={false}
      >
        <text x="90" y="164" fill="#ffe0a0" fontSize="16" fontWeight="700">
          SHARED CAPACITY BANK ·{' '}
          {result ? 'completed input positions' : 'topology preview · pending'}
        </text>
        <g opacity={result ? 1 : 0.55}>{units(100, 178, 'shared')}</g>
        <path d="M310 203H337V373" fill="none" stroke="#ffd17e" strokeWidth="4" />
        <text x="102" y="271" fill="#a0b1c3" fontSize="12">
          One capacity count in the result ledger
        </text>
        <text x="350" y="208" fill="#acd1ff" fontSize="15" fontWeight="700">
          A PATH
        </text>
        <text x="350" y="348" fill="#8df0cd" fontSize="15" fontWeight="700">
          B PATH
        </text>
        <path d="M337 234H433L535 203H706" fill="none" stroke="#83bcff" strokeWidth="5" />
        <path d="M337 373H433L535 339H706" fill="none" stroke="#63e6bc" strokeWidth="5" />
        <Device
          x={448}
          y={230}
          w={93}
          h={48}
          d={20}
          label="A bus"
          sublabel="connected"
          variant="bus"
          accent="blue"
        />
        <Device
          x={448}
          y={369}
          w={93}
          h={48}
          d={20}
          label="B bus"
          sublabel="connected"
          variant="bus"
          accent="mint"
        />
        <Device
          x={738}
          y={304}
          w={104}
          h={100}
          label="Critical load"
          sublabel="required duty"
          variant="rack"
          accent="amber"
        />
        <path d="M712 201 735 240M712 339 735 294" fill="none" stroke="#a8bac8" strokeWidth="3" />
        <path
          d="M768 158V177H695V202M695 177V339"
          fill="none"
          stroke="#ffd17e"
          strokeWidth="4"
          strokeDasharray="8 6"
        />
        <text x="770" y="177" fill="#ffe0a0" fontSize="11">
          shared control · not power
        </text>
        <rect x="698" y="104" width="210" height="54" rx="8" fill="#302924" stroke="#ffd17e" />
        <text x="803" y="128" textAnchor="middle" fill="#ffe0a0" fontSize="14">
          Common dependency
        </text>
        <text x="803" y="146" textAnchor="middle" fill="#edf4fa" fontSize="12">
          fuel / controls / cooling
        </text>
        <text x="708" y="414" fill="#a0b1c3" fontSize="13">
          Margin · {requiredValue(rows[1], 'rows[1]').value}
        </text>
      </SceneDiagram>
    </div>
  );
}
