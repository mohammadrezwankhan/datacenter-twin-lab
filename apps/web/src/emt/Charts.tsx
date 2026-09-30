import type { EmtConfig, EmtResult } from './engine';

type Series = { name: string; color: string; values: number[] };

const numberText = (value: number, digits = 0) =>
  new Intl.NumberFormat('en', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);

function LineChart({
  title,
  subtitle,
  unit,
  config,
  result,
  timeMark,
  series,
}: {
  title: string;
  subtitle: string;
  unit: string;
  config: EmtConfig;
  result: EmtResult;
  timeMark: number;
  series: Series[];
}) {
  const width = 720;
  const height = 284;
  const left = 64;
  const right = 19;
  const top = 20;
  const bottom = 44;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const allValues = series.flatMap((item) => item.values).filter(Number.isFinite);
  const observedMin = Math.min(...allValues);
  const observedMax = Math.max(...allValues);
  const observedRange = Math.max(1e-9, observedMax - observedMin);
  const padding = Math.max(1, observedRange * 0.08);
  const low = observedMin - padding;
  const high = observedMax + padding;
  const spanMs = Math.max(1e-9, config.duration_ms);
  const x = (timeMs: number) => left + (timeMs / spanMs) * plotWidth;
  const y = (value: number) => top + ((high - value) / (high - low)) * plotHeight;
  const ticks = Array.from({ length: 5 }, (_, index) => high - (index / 4) * (high - low));
  const timeTicks = Array.from({ length: 5 }, (_, index) => (index / 4) * spanMs);
  const pathFor = (values: number[]) =>
    result.rows
      .map(
        (row, index) =>
          (index === 0 ? 'M' : 'L') +
          x(row.time_ms).toFixed(2) +
          ' ' +
          y(values[index] ?? values[values.length - 1] ?? 0).toFixed(2),
      )
      .join(' ');
  const cursorX = x(Math.max(0, Math.min(spanMs, timeMark)));
  const eventLeft = x(config.sag_start_ms);
  const eventRight = x(Math.min(config.duration_ms, config.sag_start_ms + config.sag_duration_ms));
  const minLabel = numberText(observedMin, unit === 'A' ? 2 : 1);
  const maxLabel = numberText(observedMax, unit === 'A' ? 2 : 1);
  const description =
    title +
    ', ' +
    minLabel +
    ' to ' +
    maxLabel +
    ' ' +
    unit +
    ', over 0 to ' +
    numberText(spanMs) +
    ' milliseconds. Marker at ' +
    numberText(timeMark, 2) +
    ' milliseconds.';

  return (
    <section className="emt-chart-card" aria-label={title}>
      <div className="emt-chart-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className="emt-chart-range">
          {minLabel}–{maxLabel} {unit}
        </span>
      </div>
      <div className="emt-chart-legend">
        {series.map((item) => (
          <span key={item.name}>
            <i style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
        <span className="emt-event-legend">
          <i />
          Source sag
        </span>
      </div>
      <svg
        className="emt-chart"
        viewBox={'0 0 ' + width + ' ' + height}
        role="img"
        aria-label={description}
      >
        <title>{description}</title>
        <rect
          x={eventLeft}
          y={top}
          width={Math.max(0, eventRight - eventLeft)}
          height={plotHeight}
          fill="#ee788a"
          opacity=".075"
        />
        {ticks.map((value, index) => {
          const yPos = y(value);
          return (
            <g key={'y' + index}>
              <path
                d={'M' + left + ' ' + yPos + 'H' + (width - right)}
                className="emt-chart-grid"
              />
              <text x={left - 10} y={yPos + 4} textAnchor="end">
                {numberText(value, unit === 'A' ? 1 : 0)}
              </text>
            </g>
          );
        })}
        {timeTicks.map((value, index) => {
          const xPos = x(value);
          return (
            <g key={'x' + index}>
              <path
                d={'M' + xPos + ' ' + top + 'V' + (top + plotHeight)}
                className="emt-chart-grid vertical"
              />
              <text
                x={xPos}
                y={height - 20}
                textAnchor={index === 0 ? 'start' : index === 4 ? 'end' : 'middle'}
              >
                {numberText(value)}
              </text>
            </g>
          );
        })}
        <path
          d={'M' + left + ' ' + (top + plotHeight) + 'H' + (width - right)}
          className="emt-chart-axis"
        />
        <text
          transform={'rotate(-90 15 ' + (top + plotHeight / 2) + ')'}
          x="15"
          y={top + plotHeight / 2}
          textAnchor="middle"
          className="emt-axis-label"
        >
          {title === 'Voltage' ? 'Voltage · V' : 'Current · A'}
        </text>
        <text
          x={left + plotWidth / 2}
          y={height - 2}
          textAnchor="middle"
          className="emt-axis-label"
        >
          Time · ms
        </text>
        {series.map((item) => (
          <path
            key={item.name}
            d={pathFor(item.values)}
            fill="none"
            stroke={item.color}
            strokeWidth={item.name === 'DC bus' ? 2.8 : 2.1}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <path
          d={'M' + cursorX + ' ' + top + 'V' + (top + plotHeight)}
          className="emt-chart-cursor"
        />
        <circle
          cx={cursorX}
          cy={y(
            series[series.length - 1]?.values[
              Math.min(
                result.rows.length - 1,
                Math.round((timeMark / spanMs) * (result.rows.length - 1)),
              )
            ] ?? 0,
          )}
          r="4"
          fill={series[series.length - 1]?.color}
          className="emt-chart-dot"
        />
      </svg>
    </section>
  );
}

export function EmtCharts({ result, timeMark }: { result: EmtResult; timeMark: number }) {
  const { config, rows } = result;
  return (
    <div className="emt-charts">
      <LineChart
        title="Voltage"
        subtitle="The input event steps first; capacitor voltage follows the R–L–C state."
        unit="V"
        config={config}
        result={result}
        timeMark={timeMark}
        series={[
          { name: 'Source', color: '#58d8e8', values: rows.map((row) => row.source_v) },
          { name: 'DC bus', color: '#f0788f', values: rows.map((row) => row.bus_v) },
        ]}
      />
      <LineChart
        title="Source current"
        subtitle="Current through the series resistance and inductance."
        unit="A"
        config={config}
        result={result}
        timeMark={timeMark}
        series={[
          { name: 'Source current', color: '#f1b451', values: rows.map((row) => row.source_a) },
        ]}
      />
    </div>
  );
}
