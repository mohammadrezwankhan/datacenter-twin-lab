import { requiredPresent } from '../../required-value';
import { useState } from 'react';
import type { SceneProps } from './types';
import { numberOutput } from './types';
import { Device, SceneDiagram } from './primitives';

export default function ProtectionScene({ result, step }: SceneProps) {
  const [faultId, setFaultId] = useState('cable');
  const rows = [
    { label: 'Inverse-time screen', value: numberOutput(result, 'tripS', 's', 4) },
    {
      label: 'Operating multiple',
      value: result ? String(result.inputs.multiple ?? 'Not reported') : 'Run to calculate',
    },
    {
      label: 'Time multiplier setting',
      value: result ? String(result.inputs.tms ?? 'Not reported') : 'Run to calculate',
    },
    { label: 'Coverage determination', value: 'Needs model evidence and engineering review' },
  ];
  const story = [
    'Current transformers and breakers define the physical positions used for zone limits.',
    'Zone boundaries follow CT locations; distance on the page is not a setting.',
    'The highlighted marker is a selected teaching fault location.',
    'Missing coverage or weak trip DC remains a review issue; no safety approval is implied.',
  ][step];
  const faultLocations = [
    { id: 'source', title: 'Source side', x: 290 },
    { id: 'cable', title: 'Cable zone', x: 555 },
    { id: 'load', title: 'Load side', x: 730 },
  ];
  const selectedFault = requiredPresent(
    faultLocations.find((location) => location.id === faultId),
    'faultLocations.find((location) => location.id === faultId)',
  );
  return (
    <div className="infra-scene-composition">
      <div
        className="infra-scene-composition-controls"
        role="group"
        aria-label="Select a protection study location"
      >
        {faultLocations.map((location) => (
          <button
            type="button"
            key={location.id}
            aria-pressed={faultId === location.id}
            onClick={() => {
              setFaultId(location.id);
            }}
          >
            {location.title}
          </button>
        ))}
      </div>
      <p className="infra-scene-local-note" role="status">
        Selected inspection location: {selectedFault.title}. The displayed trip-time screen depends
        on the completed curve inputs, not this location selector.
      </p>
      <SceneDiagram
        id="protection"
        title="CT-defined protection zones"
        description={`${String(story)} Selected fault location: ${selectedFault.title}; the model trip-time result is unchanged.`}
        rows={rows}
        flat={false}
      >
        <Device
          x={92}
          y={257}
          w={92}
          h={68}
          label="Source"
          sublabel="infeed"
          variant="bus"
          accent="blue"
        />
        <Device
          x={830}
          y={257}
          w={92}
          h={68}
          label="Load"
          sublabel="outgoing"
          variant="bus"
          accent="amber"
        />
        <path d="M198 219H818" stroke="#69d8d3" strokeWidth="8" />
        <path d="M198 219H818" stroke="#0a1720" strokeWidth="2" strokeDasharray="7 7" />
        {[245, 411, 625].map((x, index) => (
          <g key={x}>
            <circle cx={x} cy="219" r="19" fill="#0d1b25" stroke="#ffd17e" strokeWidth="4" />
            <text x={x} y="224" textAnchor="middle" fill="#ffe0a0" fontSize="12">
              CT{index + 1}
            </text>
          </g>
        ))}
        <Device
          x={320}
          y={260}
          w={75}
          h={82}
          label="CB1"
          sublabel="breaker"
          variant="cabinet"
          accent="coral"
        />
        <Device
          x={700}
          y={260}
          w={75}
          h={82}
          label="CB2"
          sublabel="breaker"
          variant="cabinet"
          accent="coral"
        />
        <path
          d="M226 178H428V296H226ZM428 178H645V296H428ZM645 178H802V296H645Z"
          fill="none"
          stroke="#83bcff"
          strokeWidth="2"
          strokeDasharray="7 6"
          opacity=".8"
        />
        <text x="327" y="164" textAnchor="middle" fill="#acd1ff" fontSize="14">
          Zone 1 · CT1–CT2
        </text>
        <text x="537" y="164" textAnchor="middle" fill="#acd1ff" fontSize="14">
          Zone 2 · CT2–CT3
        </text>
        <text x="723" y="164" textAnchor="middle" fill="#acd1ff" fontSize="14">
          Zone 3 · CT3–CB2
        </text>
        <path
          d={`M${String(selectedFault.x - 20)} 205 ${String(selectedFault.x)} 181 ${String(selectedFault.x + 20)} 205 ${String(selectedFault.x)} 229Z`}
          fill="#302427"
          stroke="#ff9e8b"
          strokeWidth="3"
        />
        <text x={selectedFault.x} y="134" textAnchor="middle" fill="#ffb4a7" fontSize="14">
          {selectedFault.title}
        </text>
        <path d={`M${String(selectedFault.x)} 157V177`} stroke="#ff9e8b" strokeDasharray="5 4" />
        <rect x="325" y="343" width="352" height="54" rx="8" fill="#142736" stroke="#496273" />
        <text x="501" y="366" textAnchor="middle" fill="#edf4fa" fontSize="14">
          Detection → trip logic → coil → breaker action
        </text>
        <text x="501" y="385" textAnchor="middle" fill="#a0b1c3" fontSize="12">
          Trip DC and measured evidence are separate inputs
        </text>
      </SceneDiagram>
    </div>
  );
}
