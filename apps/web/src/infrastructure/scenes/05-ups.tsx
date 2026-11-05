import { requiredValue } from '../../required-value';
import type { SceneProps } from './types';
import { numberOutput } from './types';
import { Cable, Device, SceneDiagram } from './primitives';

export default function UpsScene({ result, step }: SceneProps) {
  const rows = [
    { label: 'AC load energy', value: numberOutput(result, 'acKWh', 'kWh', 2) },
    { label: 'Delivered DC energy', value: numberOutput(result, 'deliveredDcKWh', 'kWh', 2) },
    { label: 'Nominal stored energy screen', value: numberOutput(result, 'nominalKWh', 'kWh', 2) },
    { label: 'Minimum-voltage DC current', value: numberOutput(result, 'dcA', 'A', 1) },
  ];
  const story = [
    'Rectifier, DC link and inverter remain separate conversion layers.',
    'Battery delivery and bypass use distinct routes.',
    'AC load energy, delivered DC energy and nominal stored energy are nested quantities.',
    'Station DC has its own outgoing and return conductors.',
  ][step];
  return (
    <SceneDiagram
      id="ups"
      title="Exploded UPS and station DC"
      description={requiredValue(story, 'scene storyboard step')}
      rows={rows}
      flat={false}
    >
      <Device
        x={76}
        y={263}
        w={114}
        h={88}
        label="AC input"
        sublabel="supply"
        variant="bus"
        accent="blue"
      />
      <Device x={260} y={263} w={112} h={101} label="Rectifier" sublabel="AC → DC" accent="teal" />
      <Device
        x={450}
        y={263}
        w={112}
        h={79}
        label="DC link"
        sublabel="intermediate"
        accent="violet"
      />
      <Device x={640} y={263} w={112} h={101} label="Inverter" sublabel="DC → AC" accent="teal" />
      <Device
        x={830}
        y={263}
        w={104}
        h={88}
        label="IT load"
        sublabel="critical bus"
        variant="rack"
        accent="amber"
      />
      <Cable d="M216 210H260" kind="power" />
      <Cable d="M398 210H450" kind="power" label="DC" x={424} y={184} />
      <Cable d="M588 210H640" kind="power" label="DC" x={614} y={184} />
      <Cable d="M778 210H830" kind="power" />
      <text x="238" y="198" textAnchor="middle" fill="#edf4fa" fontSize="12">
        AC
      </text>
      <text x="804" y="198" textAnchor="middle" fill="#edf4fa" fontSize="12">
        AC
      </text>
      <Device
        x={456}
        y={386}
        w={160}
        h={54}
        label="Battery string"
        sublabel="stored energy"
        accent="violet"
      />
      <Cable d="M535 263V332" kind="path-b" label="stored-energy route" x={602} y={301} />
      <path
        d="M216 210V160H830V210"
        fill="none"
        stroke="#ffd17e"
        strokeWidth="4"
        strokeDasharray="8 6"
      />
      <text x="517" y="151" textAnchor="middle" fill="#ffe0a0" fontSize="13">
        Maintenance bypass · direct AC route
      </text>
      <rect x="86" y="103" width="326" height="52" rx="8" fill="#142736" stroke="#496273" />
      <text x="249" y="126" textAnchor="middle" fill="#edf4fa" fontSize="14">
        Accounting ladder
      </text>
      <text x="249" y="145" textAnchor="middle" fill="#a0b1c3" fontSize="12">
        AC kWh → delivered DC kWh → nominal kWh
      </text>
      <rect x="760" y="335" width="160" height="44" rx="7" fill="#302427" stroke="#ff9e8b" />
      <text x="840" y="353" textAnchor="middle" fill="#ffb4a7" fontSize="13">
        Station DC panel
      </text>
      <text x="840" y="371" textAnchor="middle" fill="#edf4fa" fontSize="11">
        separate circuit
      </text>
      <rect x="501" y="344" width="144" height="39" rx="7" fill="#102330" stroke="#ff9e8b" />
      <text x="573" y="368" textAnchor="middle" fill="#ffb4a7" fontSize="12">
        Trip coil / load
      </text>
      <path d="M760 350H645" fill="none" stroke="#ff9e8b" strokeWidth="3" />
      <path d="M645 378H760" fill="none" stroke="#ff9e8b" strokeWidth="3" strokeDasharray="8 5" />
      <text x="700" y="344" textAnchor="middle" fill="#ffb4a7" fontSize="11">
        outgoing
      </text>
      <text x="700" y="399" textAnchor="middle" fill="#ffb4a7" fontSize="11">
        return
      </text>
      <text x="841" y="422" textAnchor="middle" fill="#ffb4a7" fontSize="12">
        outgoing ··· return
      </text>
      {step === 3 && (
        <text x="602" y="356" fill="#ffb4a7" fontSize="12">
          Return conductor shown separately
        </text>
      )}
    </SceneDiagram>
  );
}
