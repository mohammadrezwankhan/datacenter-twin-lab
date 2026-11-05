import { requiredValue } from '../../required-value';
import type { SceneProps } from './types';
import { numberOutput, textOutput } from './types';
import { Cable, Device, SceneDiagram } from './primitives';

export default function NetworkScene({ result, step }: SceneProps) {
  const input = (key: string, unit: string) => {
    const value = result?.inputs[key];
    if (!result) return 'Not run';
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not supplied';
    return `${String(value)} ${unit}`;
  };
  const rows = [
    { label: 'Physical span length', value: input('lengthM', 'm') },
    { label: 'Fiber attenuation assumption', value: input('dbPerKm', 'dB/km') },
    {
      label: 'Connectors · count × stated loss each',
      value: `${input('connectors', 'connectors')} · ${input('connectorDB', 'dB each')}`,
    },
    {
      label: 'Splices · count × stated loss each',
      value: `${input('splices', 'splices')} · ${input('spliceDB', 'dB each')}`,
    },
    {
      label: 'Calculated physical route loss',
      value: numberOutput(result, 'physicalLossDB', 'dB', 3),
    },
    { label: 'Loss plus engineering margin', value: numberOutput(result, 'budgetUseDB', 'dB', 3) },
    {
      label: 'Remaining optical margin',
      value: numberOutput(result, 'remainingMarginDB', 'dB', 3),
    },
    { label: 'Active uplink capacity', value: numberOutput(result, 'activeUplinkGbps', 'Gb/s', 1) },
    { label: 'Fabric connectivity', value: textOutput(result, 'connectivity') },
    { label: 'Downlink/uplink ratio', value: numberOutput(result, 'oversubscription', '×', 2) },
  ];
  const story = [
    'Physical entrance, distribution rooms and rack destinations stay on the floor plane.',
    'The leaf–spine network is lifted into a distinct logical layer.',
    'Optical loss, connector/splice terms and reserved margin remain separate ledger rows.',
    'Uplink capacity and shared cable trays describe different constraints.',
  ][step];
  return (
    <SceneDiagram
      id="network"
      title="Physical route beneath the logical fabric"
      description={requiredValue(story, 'scene storyboard step')}
      rows={rows}
      flat={false}
    >
      <path d="M72 298 273 238 463 300 270 368Z" fill="#122632" stroke="#59717d" strokeWidth="2" />
      <text x="273" y="387" textAnchor="middle" fill="#edf4fa" fontSize="15" fontWeight="700">
        PHYSICAL FLOOR · cable trays
      </text>
      <Device
        x={91}
        y={278}
        w={91}
        h={70}
        label="Entrance"
        sublabel="meet-me room"
        variant="cabinet"
        accent="blue"
      />
      <Device
        x={316}
        y={316}
        w={91}
        h={70}
        label="Distribution"
        sublabel="cross-connect"
        variant="cabinet"
        accent="blue"
      />
      <Device
        x={616}
        y={285}
        w={80}
        h={78}
        label="Rack row"
        sublabel="leaf pair"
        variant="rack"
        accent="mint"
      />
      <Cable d="M185 251 313 287 612 260" kind="network" label="physical route" x={386} y={244} />
      <path d="M650 193 765 120 876 193 764 265Z" fill="#152a37" stroke="#a997d2" strokeWidth="2" />
      <path
        d="M680 183 765 131 850 183M680 207 765 155 850 207"
        fill="none"
        stroke="#c0a5ff"
        strokeWidth="3"
        strokeDasharray="8 6"
      />
      <circle cx="681" cy="183" r="13" fill="#253047" stroke="#c0a5ff" strokeWidth="2" />
      <circle cx="765" cy="131" r="13" fill="#253047" stroke="#c0a5ff" strokeWidth="2" />
      <circle cx="850" cy="183" r="13" fill="#253047" stroke="#c0a5ff" strokeWidth="2" />
      <text x="681" y="188" textAnchor="middle" fill="#edf4fa" fontSize="11">
        L
      </text>
      <text x="765" y="136" textAnchor="middle" fill="#edf4fa" fontSize="11">
        S
      </text>
      <text x="850" y="188" textAnchor="middle" fill="#edf4fa" fontSize="11">
        L
      </text>
      <text x="765" y="96" textAnchor="middle" fill="#d4c5ff" fontSize="15" fontWeight="700">
        LOGICAL FABRIC · leaf–spine
      </text>
      <path d="M694 271 660 291" stroke="#c0a5ff" strokeWidth="3" strokeDasharray="5 5" />
      <rect x="770" y="293" width="174" height="56" rx="8" fill="#302d23" stroke="#ffd17e" />
      <text x="857" y="317" textAnchor="middle" fill="#ffe0a0" fontSize="14">
        Shared tray exposure
      </text>
      <text x="857" y="337" textAnchor="middle" fill="#edf4fa" fontSize="12">
        physical common route
      </text>
      <text x="774" y="380" fill="#a0b1c3" fontSize="13">
        Optical margin · {requiredValue(rows[6], 'rows[6]').value}
      </text>
    </SceneDiagram>
  );
}
