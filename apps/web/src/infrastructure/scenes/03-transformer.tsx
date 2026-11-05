import { requiredValue } from '../../required-value';
import type { SceneProps } from './types';
import { numberOutput } from './types';
import { Cable, Device, SceneDiagram } from './primitives';

export default function TransformerScene({ result, step }: SceneProps) {
  const rows = [
    { label: 'Transformer impedance', value: numberOutput(result, 'transformerOhm', 'Ω', 6) },
    { label: 'Source impedance', value: numberOutput(result, 'sourceOhm', 'Ω', 6) },
    { label: 'Transformer base impedance', value: numberOutput(result, 'baseOhm', 'Ω', 4) },
    { label: 'Three-phase fault screen', value: numberOutput(result, 'faultKA', 'kA RMS', 3) },
    { label: 'Full-load current screen', value: numberOutput(result, 'fullLoadA', 'A', 1) },
  ];
  const story = [
    'Source, transformer and outgoing route are separate series elements.',
    'Each impedance stays labelled in ohms on its stated base.',
    'The fault marker identifies the selected study point; the number comes from the completed model.',
    'RMS, peak, interruption and detection duties remain separate review questions.',
  ][step];
  return (
    <SceneDiagram
      id="transformer"
      title="Layered equivalent circuit"
      description={requiredValue(story, 'scene storyboard step')}
      rows={rows}
      flat={false}
    >
      <Device
        x={84}
        y={300}
        w={118}
        h={104}
        label="Source"
        sublabel="finite source"
        variant="bus"
        accent="blue"
      />
      <Device
        x={354}
        y={300}
        w={142}
        h={132}
        label="Transformer"
        sublabel="series impedance"
        variant="transformer"
        accent="amber"
      />
      <Device
        x={690}
        y={300}
        w={134}
        h={96}
        label="Cable route"
        sublabel="downstream path"
        variant="cabinet"
        accent="teal"
      />
      <Cable d="M228 248H354" kind="power" label="Zsource" x={291} y={221} />
      <Cable d="M522 248H690" kind="power" label="Ztransformer" x={606} y={221} />
      <path d="M850 248H900" fill="none" stroke="#69d8d3" strokeWidth="4" />
      <circle cx="900" cy="248" r="19" fill="#172936" stroke="#ff9e8b" strokeWidth="3" />
      <path d="M891 248h18M900 239v18" stroke="#ff9e8b" strokeWidth="2" />
      <text x="900" y="290" textAnchor="middle" fill="#ffb4a7" fontSize="14">
        Fault study point
      </text>
      <rect x="235" y="116" width="210" height="46" rx="8" fill="#142736" stroke="#496273" />
      <text x="340" y="145" textAnchor="middle" fill="#edf4fa" fontSize="14">
        Base · {requiredValue(rows[2], 'rows[2]').value}
      </text>
      {step >= 2 && (
        <g>
          <path
            d="M900 229 865 162H768"
            fill="none"
            stroke="#ff9e8b"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          <rect x="702" y="112" width="218" height="48" rx="8" fill="#302427" stroke="#ff9e8b" />
          <text x="811" y="142" textAnchor="middle" fill="#ffb4a7" fontSize="14">
            Model RMS · {requiredValue(rows[3], 'rows[3]').value}
          </text>
        </g>
      )}
      <text x="494" y="374" textAnchor="middle" fill="#a0b1c3" fontSize="14">
        Separate cards: RMS duty · peak duty · interruption · minimum detection
      </text>
    </SceneDiagram>
  );
}
