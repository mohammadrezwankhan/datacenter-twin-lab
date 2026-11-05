import { requiredValue } from '../../required-value';
import type { SceneProps } from './types';
import { numberOutput } from './types';
import { Device, SceneDiagram } from './primitives';

export default function LedgerScene({ result, step }: SceneProps) {
  const rows = [
    { label: 'IT demand', value: numberOutput(result, 'itKW', 'kW', 1) },
    { label: 'Facility total', value: numberOutput(result, 'facilityKW', 'kW', 1) },
    { label: 'Residual after stated terms', value: numberOutput(result, 'residualKW', 'kW', 1) },
    { label: 'Apparent power', value: numberOutput(result, 'apparentKVA', 'kVA', 1) },
    {
      label: 'Ledger screen',
      value: result ? String(result.outputs.status ?? 'Calculated') : 'Not run',
    },
  ];
  const stepText = [
    'The rack field defines the IT boundary.',
    'Cooling electricity, conversion loss and other terms stay on separate slabs.',
    'The repeated cooling slab is marked as a duplicate term.',
    'Power and matched-interval energy retain their own units.',
  ][step];
  return (
    <SceneDiagram
      id="ledger"
      title="Facility load ledger"
      description={`${String(stepText)} ${
        result
          ? 'The diagram and table show the last completed model run.'
          : 'This is a preview. Run the model to populate the ledger values.'
      }`}
      rows={rows}
      flat={false}
    >
      <Device
        x={74}
        y={310}
        w={112}
        h={92}
        label="IT racks"
        sublabel="demand boundary"
        variant="rack"
      />
      <path d="M202 250H860" fill="none" stroke="#527081" strokeWidth="2" />
      {[
        {
          x: 250,
          label: 'IT load',
          value: requiredValue(rows[0], 'rows[0]').value,
          color: '#63e6bc',
        },
        { x: 416, label: 'Cooling electricity', value: 'Separate term', color: '#83bcff' },
        { x: 582, label: 'Conversion loss', value: 'Separate term', color: '#c0a5ff' },
        { x: 748, label: 'Other', value: 'Explicit term', color: '#ffd17e' },
      ].map((slab) => (
        <g key={slab.label}>
          <path
            d={`M${String(slab.x)} 205l26-14h122l-26 14v88l-122 0Z`}
            fill="#1b3442"
            stroke={slab.color}
            strokeWidth="2"
          />
          <path
            d={`M${String(slab.x + 122)} 205l26-14v88l-26 14Z`}
            fill="#102430"
            stroke={slab.color}
          />
          <text x={slab.x + 61} y="229" textAnchor="middle" fill="#edf4fa" fontSize="14">
            {slab.label}
          </text>
          <text x={slab.x + 61} y="256" textAnchor="middle" fill="#a0b1c3" fontSize="12">
            {slab.value}
          </text>
        </g>
      ))}
      <path d="M284 293v25h532v-25" fill="none" stroke="#69d8d3" strokeWidth="3" />
      <rect x="396" y="321" width="310" height="47" rx="8" fill="#152a36" stroke="#69d8d3" />
      <text x="551" y="342" textAnchor="middle" fill="#edf4fa" fontSize="15" fontWeight="650">
        Facility total · {requiredValue(rows[1], 'rows[1]').value}
      </text>
      <text x="551" y="359" textAnchor="middle" fill="#a0b1c3" fontSize="12">
        Matched terms only · kW
      </text>
      {step >= 2 && (
        <g>
          <rect x="407" y="112" width="204" height="56" rx="8" fill="#302924" stroke="#ffd17e" />
          <text x="509" y="136" textAnchor="middle" fill="#ffe0a0" fontSize="14">
            Duplicate cooling term
          </text>
          <text x="509" y="154" textAnchor="middle" fill="#edf4fa" fontSize="12">
            would be counted twice
          </text>
          <path d="M480 168 481 190" stroke="#ffd17e" strokeDasharray="5 4" />
        </g>
      )}
      {step === 3 && (
        <text x="500" y="396" textAnchor="middle" fill="#a0b1c3" fontSize="14">
          Energy ledger uses the same interval · kWh
        </text>
      )}
    </SceneDiagram>
  );
}
