import { requiredValue } from '../../required-value';
import type { SceneProps } from './types';
import { numberOutput } from './types';
import { Device, SceneDiagram } from './primitives';

export default function FacilitiesScene({ result, step }: SceneProps) {
  const rows = [
    { label: 'Illustrative floor pressure', value: numberOutput(result, 'averageKPa', 'kPa', 2) },
    {
      label: 'Installed cooling nameplate sum',
      value: numberOutput(result, 'installedThermalKW', 'kW thermal', 2),
    },
    { label: 'Historical datum boundary', value: 'Reported source boundary; not a current survey' },
    {
      label: 'Phase state',
      value: requiredValue(
        ['Initial occupancy', 'Expansion works', 'Tie-in', 'Final configuration'][step],
        'facilities phase',
      ),
    },
  ];
  const phases = ['Initial occupancy', 'Expansion works', 'Tie-in', 'Final configuration'];
  const story = [
    'Gross building, tenant, technical and access areas use different boundaries.',
    'A maintained replacement route is reserved beside the live rack field.',
    'Expansion and tie-in work use an explicit phase view.',
    'Historical values retain their reported date, boundary and limitation.',
  ][step];
  return (
    <SceneDiagram
      id="facilities"
      title="Phase-aware building cutaway"
      description={requiredValue(story, 'scene storyboard step')}
      rows={rows}
      flat={false}
    >
      <path
        d="M72 325 246 254 642 254 850 326 652 394 270 394Z"
        fill="#101f2a"
        stroke="#516978"
        strokeWidth="2"
      />
      <path
        d="M91 296 91 160 290 88 290 287M290 88 635 88 635 240 290 287M635 88 832 158 832 296 635 240"
        fill="#132a38"
        stroke="#547082"
        strokeWidth="2"
      />
      <path
        d="M91 160 290 229 635 229 832 158"
        fill="none"
        stroke="#83bcff"
        strokeWidth="2"
        strokeDasharray="8 6"
      />
      <path d="M290 88 290 287M635 88 635 240" fill="none" stroke="#69d8d3" strokeWidth="2" />
      <text x="159" y="139" fill="#acd1ff" fontSize="14">
        Tenant boundary
      </text>
      <text x="400" y="112" fill="#8df0cd" fontSize="14">
        Technical floor
      </text>
      <text x="724" y="168" fill="#ffd17e" fontSize="14">
        Access zone
      </text>
      <Device
        x={386}
        y={283}
        w={126}
        h={104}
        label="Rack field"
        sublabel="technical occupancy"
        variant="rack"
        accent="mint"
      />
      <path
        d="M110 336H269L360 305"
        fill="none"
        stroke="#ffd17e"
        strokeWidth="5"
        strokeDasharray="9 6"
      />
      <rect x="94" y="339" width="191" height="37" rx="7" fill="#302d23" stroke="#ffd17e" />
      <text x="189" y="363" textAnchor="middle" fill="#ffe0a0" fontSize="13">
        Maintained replacement route
      </text>
      <text x="719" y="272" fill="#a0b1c3" fontSize="13">
        Cooling nameplate
      </text>
      <text x="719" y="294" fill="#edf4fa" fontSize="15">
        {requiredValue(rows[1], 'rows[1]').value}
      </text>
      <path d="M90 410H910" stroke="#496273" strokeWidth="2" />
      {phases.map((phase, index) => (
        <g key={phase}>
          <circle
            cx={154 + index * 224}
            cy="410"
            r="10"
            fill={index === step ? '#63e6bc' : '#203846'}
            stroke={index === step ? '#63e6bc' : '#8196a5'}
            strokeWidth="2"
          />
          <text x={154 + index * 224} y="407" textAnchor="middle" fill="#edf4fa" fontSize="10">
            {index + 1}
          </text>
          <text x={154 + index * 224} y="431" textAnchor="middle" fill="#a0b1c3" fontSize="12">
            {phase}
          </text>
        </g>
      ))}
      <text x="897" y="116" textAnchor="end" fill="#ffd17e" fontSize="12">
        Historical values ≠ current operation
      </text>
    </SceneDiagram>
  );
}
