import { requiredValue } from '../../required-value';
import type { SceneProps } from './types';
import { numberOutput } from './types';
import { SceneDiagram } from './primitives';

export default function CommissioningScene({ result, step }: SceneProps) {
  const rows = [
    { label: 'Restoration duration', value: numberOutput(result, 'restoreSeconds', 's', 2) },
    { label: 'Thermal margin', value: numberOutput(result, 'thermalMarginSeconds', 's', 2) },
    { label: 'Electrical margin', value: numberOutput(result, 'electricalMarginSeconds', 's', 2) },
    { label: 'Annual facility energy', value: numberOutput(result, 'annualFacilityMWh', 'MWh', 1) },
    { label: 'Evidence acceptance', value: 'Open until records satisfy each criterion' },
  ];
  const stageSeconds = result?.inputs.stageSeconds;
  const durations = Array.isArray(stageSeconds) ? stageSeconds : null;
  const stageNames = ['Detect', 'Start & accelerate', 'Qualify', 'Restore load'];
  const shownDurations = durations?.slice(0, 4);
  const total =
    shownDurations?.reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0) ?? 1;
  const story = [
    'The sequence links a requirement to an observed state and expected response.',
    'Completed input stage times use physical seconds; the narrative scrubber itself is not a time axis.',
    'Instrument records attach to criteria and must be reviewable.',
    'Discrepancies go through correction and retest before acceptance.',
  ][step];
  return (
    <SceneDiagram
      id="commissioning"
      title="Commissioning evidence wall"
      description={requiredValue(story, 'scene storyboard step')}
      rows={rows}
      flat={false}
    >
      {[
        ['Requirement', 'service restored'],
        ['State', 'utility unavailable'],
        ['Event', 'backup sequence'],
        ['Expected response', 'load accepted'],
      ].map(([label, value], index) => (
        <g key={label}>
          <rect
            x={61 + index * 224}
            y="103"
            width="184"
            height="61"
            rx="8"
            fill="#142736"
            stroke="#527081"
            strokeWidth="2"
          />
          <text
            x={153 + index * 224}
            y="128"
            textAnchor="middle"
            fill="#8df0cd"
            fontSize="14"
            fontWeight="700"
          >
            {label}
          </text>
          <text x={153 + index * 224} y="149" textAnchor="middle" fill="#edf4fa" fontSize="13">
            {value}
          </text>
          {index < 3 && (
            <path d={`M245 133H${String(274 + index * 224)}`} stroke="#69d8d3" strokeWidth="3" />
          )}
        </g>
      ))}
      <text x="72" y="205" fill="#edf4fa" fontSize="15" fontWeight="700">
        Physical restoration sequence
        {result ? ' · seconds from completed inputs' : ' · run to apply stage durations'}
      </text>
      {stageNames.map((name, index) => {
        const duration = shownDurations?.[index];
        const width =
          typeof duration === 'number' && total > 0 ? Math.max(24, (duration / total) * 820) : 205;
        const left =
          76 +
          stageNames.slice(0, index).reduce((sum, _, earlier) => {
            const prior = shownDurations?.[earlier];
            return (
              sum +
              (typeof prior === 'number' && total > 0 ? Math.max(24, (prior / total) * 820) : 205)
            );
          }, 0);
        return (
          <g key={name}>
            <rect
              x={left}
              y="225"
              width={Math.min(width - 3, 820 - (left - 76))}
              height="44"
              rx="6"
              fill={['#1c4b47', '#1b3e52', '#3a3554', '#50402a'][index]}
              stroke="#7c9aa6"
            />
            <text
              x={left + Math.min(width - 3, 820 - (left - 76)) / 2}
              y="244"
              textAnchor="middle"
              fill="#edf4fa"
              fontSize="12"
            >
              {name}
            </text>
            <text
              x={left + Math.min(width - 3, 820 - (left - 76)) / 2}
              y="261"
              textAnchor="middle"
              fill="#c0cfda"
              fontSize="11"
            >
              {typeof duration === 'number' ? `${String(duration)} s` : 'Not run'}
            </text>
          </g>
        );
      })}
      {[
        ['Voltage', 'record'],
        ['Frequency', 'record'],
        ['Breaker', 'state'],
        ['DC voltage', 'record'],
        ['Flow & temperature', 'record'],
      ].map(([label, value], index) => (
        <g key={label}>
          <rect
            x={72 + index * 176}
            y="311"
            width="156"
            height="56"
            rx="7"
            fill="#102330"
            stroke="#496273"
          />
          <text x={150 + index * 176} y="335" textAnchor="middle" fill="#edf4fa" fontSize="13">
            {label}
          </text>
          <text x={150 + index * 176} y="355" textAnchor="middle" fill="#a0b1c3" fontSize="12">
            {value} slot · synthetic
          </text>
        </g>
      ))}
      <path
        d="M860 286V382H340V372"
        fill="none"
        stroke="#ff9e8b"
        strokeWidth="3"
        strokeDasharray="8 6"
      />
      <rect x="349" y="377" width="217" height="33" rx="7" fill="#302427" stroke="#ff9e8b" />
      <text x="457" y="399" textAnchor="middle" fill="#ffb4a7" fontSize="13">
        Discrepancy → correct → retest
      </text>
      <text x="777" y="397" fill="#a0b1c3" fontSize="13">
        Thermal {requiredValue(rows[1], 'rows[1]').value} · electrical{' '}
        {requiredValue(rows[2], 'rows[2]').value}
      </text>
    </SceneDiagram>
  );
}
