import { requiredValue } from '../../required-value';
import type { SceneProps } from './types';
import { numberOutput, textOutput } from './types';
import { SceneDiagram } from './primitives';

const gateState = (value: unknown): 'PASS' | 'FAIL' | 'UNRESOLVED' => {
  if (value === 'pass' || value === 'screen-satisfied') return 'PASS';
  if (value === 'fail' || value === 'screen-failed') return 'FAIL';
  return 'UNRESOLVED';
};

export default function ReleaseScene({ result, step }: SceneProps) {
  const outputs = result?.outputs ?? {};
  const gates = [
    ['Capacity', gateState(outputs.capacityStatus)],
    ['Connectivity', gateState(outputs.connectivityStatus)],
    ['Protection', gateState(outputs.protectionStatus)],
    ['Thermal', gateState(outputs.thermalStatus)],
    ['Controls', gateState(outputs.controlsStatus)],
    ['Evidence', gateState(outputs.evidenceStatus)],
  ] as const;
  const hasBlocker = gates.some(([, state]) => state !== 'PASS');
  const decision = hasBlocker ? 'HOLD' : 'HOLD · required project evidence remains open';
  const rows = [
    {
      label: 'Available transformer capacity',
      value: numberOutput(result, 'availableMVA', 'MVA', 2),
    },
    { label: 'Capacity margin', value: numberOutput(result, 'marginMVA', 'MVA', 2) },
    { label: 'Full-load current', value: numberOutput(result, 'fullLoadA', 'A', 2) },
    { label: 'Incomer current margin', value: numberOutput(result, 'incomerMarginA', 'A', 2) },
    { label: 'Release decision', value: decision },
  ];
  const story = [
    'The twenty-megawatt screen and the separate campus remedy keep distinct identities.',
    'A corrected transformer count must clear capacity while the incomer current issue remains visible.',
    'Unit count changes do not close an independent current-duty issue.',
    'Six explicit gates remain visible; any failed or unresolved gate blocks release.',
  ][step];
  return (
    <SceneDiagram
      id="release"
      title="Evidence-controlled release gate"
      description={`${String(story)} The release state is held when any gate fails or remains unresolved.`}
      rows={rows}
      flat={false}
    >
      <rect x="57" y="102" width="370" height="62" rx="8" fill="#142736" stroke="#527081" />
      <text x="242" y="127" textAnchor="middle" fill="#edf4fa" fontSize="15" fontWeight="700">
        20 MW review case
      </text>
      <text x="242" y="149" textAnchor="middle" fill="#a0b1c3" fontSize="13">
        generator claim failed · open studies retained
      </text>
      <rect x="573" y="102" width="370" height="62" rx="8" fill="#142736" stroke="#527081" />
      <text x="758" y="127" textAnchor="middle" fill="#edf4fa" fontSize="15" fontWeight="700">
        Separate campus remedy
      </text>
      <text x="758" y="149" textAnchor="middle" fill="#a0b1c3" fontSize="13">
        capacity margin · {requiredValue(rows[1], 'rows[1]').value} · current{' '}
        {textOutput(result, 'currentStatus')}
      </text>
      <path d="M242 164V203H758V164" fill="none" stroke="#83bcff" strokeWidth="3" />
      <text x="500" y="195" textAnchor="middle" fill="#acd1ff" fontSize="13">
        Related review context · do not combine source cases
      </text>
      <rect
        x="322"
        y="214"
        width="356"
        height="54"
        rx="8"
        fill="#342925"
        stroke="#ff9e8b"
        strokeWidth="2"
      />
      <text x="500" y="238" textAnchor="middle" fill="#ffb4a7" fontSize="16" fontWeight="750">
        {decision}
      </text>
      <text x="500" y="257" textAnchor="middle" fill="#edf4fa" fontSize="12">
        No certification or project release is represented
      </text>
      {gates.map(([name, status], index) => {
        const x = 57 + index * 148;
        const fail = status === 'FAIL';
        const pass = status === 'PASS';
        const color = fail ? '#ff9e8b' : pass ? '#63e6bc' : '#ffd17e';
        return (
          <g key={name}>
            <rect
              x={x}
              y="301"
              width="132"
              height="75"
              rx="8"
              fill={fail ? '#302427' : pass ? '#15352f' : '#302d23'}
              stroke={color}
              strokeWidth="2"
            />
            <text
              x={x + 66}
              y="327"
              textAnchor="middle"
              fill="#edf4fa"
              fontSize="14"
              fontWeight="650"
            >
              {name}
            </text>
            <text
              x={x + 66}
              y="354"
              textAnchor="middle"
              fill={color}
              fontSize="13"
              fontWeight="750"
            >
              {status}
            </text>
          </g>
        );
      })}
      {step >= 1 && (
        <text x="500" y="407" textAnchor="middle" fill="#a0b1c3" fontSize="13">
          Transformer correction still leaves the independent current issue ·{' '}
          {requiredValue(rows[3], 'rows[3]').value}
        </text>
      )}
    </SceneDiagram>
  );
}
