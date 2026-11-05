import { requiredValue } from '../../required-value';
import type { SceneProps } from './types';
import { numberOutput, textOutput } from './types';
import { SceneDiagram } from './primitives';

const MAX_INDIVIDUAL_UNITS = 13;
const UNIT_X = 74;
const UNIT_STEP = 44;
const UNIT_WIDTH = 36;

export default function GeneratorScene({ result, fuelResult, step }: SceneProps) {
  const inputs = result?.inputs ?? {};
  const installedInput = inputs.installed;
  const unavailableInput = inputs.unavailable;
  const requiredInput = inputs.requiredMW;
  const hasCapacityResult =
    typeof result?.outputs.availableMW === 'number' &&
    typeof installedInput === 'number' &&
    typeof unavailableInput === 'number' &&
    typeof requiredInput === 'number';
  const installed =
    hasCapacityResult && typeof installedInput === 'number'
      ? Math.max(0, Math.floor(installedInput))
      : 10;
  const unavailable =
    hasCapacityResult && typeof unavailableInput === 'number'
      ? Math.max(0, Math.min(installed, Math.floor(unavailableInput)))
      : 0;
  const shownUnits = hasCapacityResult ? Math.min(installed, MAX_INDIVIDUAL_UNITS) : 10;
  const overflow = hasCapacityResult ? Math.max(0, installed - shownUnits) : 0;
  const available = installed - unavailable;
  const requiredMW =
    hasCapacityResult && typeof requiredInput === 'number' && Number.isFinite(requiredInput)
      ? `${requiredInput.toFixed(2)} MW`
      : 'pending';
  const availableText = numberOutput(result, 'availableMW', 'MW', 2);
  const marginText = numberOutput(result, 'marginMW', 'MW', 2);
  const statusText = textOutput(result, 'status');
  const fuelInputValue = (key: string, unit: string, digits = 2) => {
    if (!fuelResult) return 'Not run';
    const value = fuelResult.inputs[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not reported by fuel screen';
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value)} ${unit}`;
  };
  const fuelLoad = fuelInputValue('loadKW', 'kW', 0);
  const fuelHours = fuelInputValue('hours', 'h', 2);
  const fuelRate = fuelInputValue('litresPerKWh', 'L/kWh', 3);
  const usableFuel = numberOutput(fuelResult ?? null, 'usableLitres', 'L', 0);
  const rows = [
    { label: 'Available capacity · each independent bank', value: availableText },
    {
      label: 'Required duty · same full load for A and B',
      value: hasCapacityResult ? requiredMW : result ? 'Not part of this result' : 'Not run',
    },
    { label: 'Capacity margin · each bank', value: marginText },
    {
      label: 'Capacity-only N+1 count · each bank',
      value: numberOutput(result, 'minimumNPlusOne', 'units', 0),
    },
    { label: 'Fuel-model applied load', value: fuelLoad },
    { label: 'Fuel-model duration', value: fuelHours },
    { label: 'Fuel-model consumption coefficient', value: fuelRate },
    { label: 'Calculated usable fuel consumption', value: usableFuel },
  ];

  const bank = (name: 'A' | 'B', y: number, busY: number) => {
    const state = hasCapacityResult
      ? `${String(installed)} installed · ${String(unavailable)} unavailable · ${String(available)} available`
      : 'topology preview · capacity counts pending';
    const directIndices = Array.from({ length: shownUnits }, (_, index) => index);
    const visibleUnavailable = Math.max(0, shownUnits - Math.max(0, installed - unavailable));
    const aggregateUnavailable = Math.max(0, unavailable - visibleUnavailable);
    const aggregateAvailable = overflow - aggregateUnavailable;
    const overflowX = UNIT_X + MAX_INDIVIDUAL_UNITS * UNIT_STEP;

    return (
      <g
        aria-label={`${name} independent full-capacity generator bank: ${state}`}
        opacity={hasCapacityResult ? 1 : 0.58}
      >
        <text x={UNIT_X} y={y - 12} fill="#ffe0a0" fontSize="14" fontWeight="700">
          {name} BANK · {state}
        </text>
        {directIndices.map((index) => {
          const unavailableUnit = index >= installed - unavailable;
          const x = UNIT_X + index * UNIT_STEP;
          return (
            <g
              key={`${name}-${String(index)}`}
              aria-label={`Generator ${String(index + 1)}${unavailableUnit ? ', unavailable' : ', available'}`}
            >
              <rect
                x={x}
                y={y}
                width={UNIT_WIDTH}
                height="52"
                rx="5"
                fill={unavailableUnit ? '#33282a' : '#352d21'}
                stroke={unavailableUnit ? '#ff9e8b' : '#ffd17e'}
                strokeWidth="2"
              />
              <path
                d={`M${String(x + 8)} ${String(y + 13)}v26M${String(x + 18)} ${String(y + 13)}v26M${String(x + 28)} ${String(y + 13)}v26`}
                stroke="#b98448"
                strokeWidth="1.5"
              />
              <text
                x={x + UNIT_WIDTH / 2}
                y={y + 18}
                textAnchor="middle"
                fill="#edf4fa"
                fontSize="10"
              >
                G{index + 1}
              </text>
              {unavailableUnit && (
                <text
                  x={x + UNIT_WIDTH / 2}
                  y={y + 48}
                  textAnchor="middle"
                  fill="#ffb4a7"
                  fontSize="8"
                >
                  OUT
                </text>
              )}
              <path
                d={`M${String(x + UNIT_WIDTH / 2)} ${String(y + 52)}V${String(busY)}`}
                stroke="#ffd17e"
                strokeWidth="2"
              />
            </g>
          );
        })}
        {overflow > 0 && (
          <g
            aria-label={`${String(overflow)} additional generators grouped: ${String(aggregateAvailable)} available and ${String(aggregateUnavailable)} unavailable`}
          >
            <title>{`${String(overflow)} additional generator units grouped as aggregate overflow: ${String(aggregateAvailable)} available, ${String(aggregateUnavailable)} unavailable.`}</title>
            <rect
              x={overflowX}
              y={y}
              width="64"
              height="52"
              rx="5"
              fill="#252d36"
              stroke="#a0b1c3"
              strokeDasharray="5 3"
            />
            <text x={overflowX + 32} y={y + 23} textAnchor="middle" fill="#edf4fa" fontSize="13">
              +{overflow}
            </text>
            <text x={overflowX + 32} y={y + 42} textAnchor="middle" fill="#a0b1c3" fontSize="9">
              aggregate
            </text>
            <path
              d={`M${String(overflowX + 32)} ${String(y + 52)}V${String(busY)}`}
              stroke="#a0b1c3"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </g>
        )}
        <path
          d={`M${String(UNIT_X)} ${String(busY)}H720`}
          fill="none"
          stroke="#ffd17e"
          strokeWidth="4"
        />
      </g>
    );
  };

  const comparison = (name: 'A' | 'B', y: number, routeY: number) => (
    <g
      aria-label={`${name} bank independent capacity comparison`}
      opacity={hasCapacityResult ? 1 : 0.58}
    >
      <path
        d={`M720 ${String(routeY)}H740V${String(y + 52)}H758`}
        fill="none"
        stroke={name === 'A' ? '#63e6bc' : '#83bcff'}
        strokeWidth="4"
      />
      <rect
        x="758"
        y={y}
        width="204"
        height="104"
        rx="8"
        fill="#142736"
        stroke={name === 'A' ? '#63e6bc' : '#83bcff'}
        strokeWidth="2"
      />
      <text x="860" y={y + 20} textAnchor="middle" fill="#edf4fa" fontSize="12" fontWeight="700">
        {name} · independent load check
      </text>
      <text x="860" y={y + 44} textAnchor="middle" fill="#edf4fa" fontSize="12">
        Available · {hasCapacityResult ? availableText : 'pending'}
      </text>
      <text x="860" y={y + 63} textAnchor="middle" fill="#edf4fa" fontSize="12">
        Required · {hasCapacityResult ? requiredMW : 'pending'}
      </text>
      <text x="860" y={y + 86} textAnchor="middle" fill="#ffe0a0" fontSize="11">
        {hasCapacityResult
          ? `Margin ${marginText} · ${statusText}`
          : 'Run capacity screen to compare'}
      </text>
    </g>
  );

  const story = [
    'A and B are independent full-capacity banks; the completed unit count is shown for each.',
    `Each bank is checked separately against the same ${requiredMW} demand; no capacities are combined.`,
    'Unavailable units and aggregate overflow follow the last completed inputs; the model still screens each bank independently.',
    'Bulk fuel transfer is a separate liquid route; it does not join the A or B electrical buses.',
  ][step];

  return (
    <SceneDiagram
      id="generator"
      title="Independent generator-bank capacity and fuel boundary"
      description={requiredValue(story, 'scene storyboard step')}
      rows={rows}
      flat={false}
    >
      {bank('A', 94, 160)}
      {bank('B', 224, 290)}
      {comparison('A', 88, 160)}
      {comparison('B', 218, 290)}
      <text x="860" y="207" textAnchor="middle" fill="#a0b1c3" fontSize="10">
        A and B remain electrically separate
      </text>
      <rect x="80" y="366" width="142" height="38" rx="7" fill="#302d23" stroke="#ffd17e" />
      <text x="151" y="390" textAnchor="middle" fill="#ffe0a0" fontSize="13">
        Bulk fuel tank
      </text>
      <path d="M222 385H280" fill="none" stroke="#ffd17e" strokeWidth="4" strokeDasharray="9 6" />
      <circle cx="298" cy="385" r="17" fill="#302d23" stroke="#ffd17e" strokeWidth="3" />
      <text x="298" y="390" textAnchor="middle" fill="#edf4fa" fontSize="12">
        P
      </text>
      <path d="M315 385H379" fill="none" stroke="#ffd17e" strokeWidth="4" strokeDasharray="9 6" />
      <rect x="379" y="366" width="142" height="38" rx="7" fill="#302d23" stroke="#ffd17e" />
      <text x="450" y="390" textAnchor="middle" fill="#ffe0a0" fontSize="13">
        Day tank
      </text>
      <text x="550" y="375" fill="#edf4fa" fontSize="11">
        Fuel run · {fuelLoad} × {fuelHours} × {fuelRate}
      </text>
      <text x="550" y="392" fill="#ffe0a0" fontSize="12">
        Usable consumption · {usableFuel}
      </text>
      <text x="550" y="409" fill="#a0b1c3" fontSize="11">
        Separate fuel ledger; no A/B electrical connection
      </text>
    </SceneDiagram>
  );
}
