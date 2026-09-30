import type { PointerEvent } from 'react';
import type { ResearchChart as ChartData } from './types';

const colors = ['#68d4df', '#efb75b', '#b69cff', '#8dcc9e', '#e98c9d'];
const fmt = (value: number, digits = 3) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(
    value,
  );

function finiteDomain(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return undefined;
  let low = Math.min(...finite);
  let high = Math.max(...finite);
  if (low === high) {
    const delta = Math.max(Math.abs(low) * 0.06, 1e-3);
    low -= delta;
    high += delta;
  }
  const padding = (high - low) * 0.06;
  return [low - padding, high + padding] as const;
}

export function ResearchChart({
  chart,
  accent,
  active,
  onFocus,
  pointIndex,
  onPointChange,
}: {
  chart: ChartData;
  accent: string;
  active: boolean;
  onFocus: () => void;
  pointIndex: number;
  onPointChange: (index: number) => void;
}) {
  const count = Math.min(
    chart.x.length,
    ...chart.lines.map((line) => line.values.length),
    chart.lines.length ? Infinity : 0,
  );
  const ys = chart.lines.flatMap((line) => line.values.slice(0, count)).filter(Number.isFinite);
  const xs = chart.x.slice(0, count).filter(Number.isFinite);
  const xLog =
    /frequency|\bhz\b/i.test(chart.x_label) && xs.length > 0 && xs.every((value) => value > 0);
  const xTransform = (value: number) => (xLog ? Math.log10(value) : value);
  const transformedXs = xs.map(xTransform);
  const rawXDomain = finiteDomain(transformedXs);
  const rawYDomain = finiteDomain(ys);
  const width = 760;
  const height = 330;
  const left = 75;
  const right = 25;
  const top = 24;
  const bottom = 56;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xMin = rawXDomain?.[0] ?? 0;
  const xMax = rawXDomain?.[1] ?? 1;
  const yMin = rawYDomain?.[0] ?? 0;
  const yMax = rawYDomain?.[1] ?? 1;
  const xPos = (value: number) => left + ((xTransform(value) - xMin) / (xMax - xMin)) * plotWidth;
  const yPos = (value: number) => top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const xTickPositions = Array.from(
    { length: 5 },
    (_, index) => xMin + (index / 4) * (xMax - xMin),
  );
  const yTickValues = Array.from({ length: 5 }, (_, index) => yMax - (index / 4) * (yMax - yMin));
  const index = Math.max(0, Math.min(Math.max(0, count - 1), pointIndex));
  const valid = count > 0 && ys.length > 0;
  const xValue = chart.x[index];
  const cleanId = chart.id.replaceAll('_', ' ').replaceAll('-', ' ');
  const pathFor = (values: number[]) => {
    const commands: string[] = [];
    let begun = false;
    for (let point = 0; point < count; point++) {
      const xv = chart.x[point];
      const yv = values[point];
      if (!Number.isFinite(xv) || !Number.isFinite(yv) || (xLog && xv <= 0)) {
        begun = false;
        continue;
      }
      commands.push((begun ? 'L' : 'M') + xPos(xv).toFixed(2) + ' ' + yPos(yv).toFixed(2));
      begun = true;
    }
    return commands.join(' ');
  };
  const lineAt = (lineIndex: number) => chart.lines[lineIndex]?.values[index];
  const focusPointFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (count < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * width;
    const target = xMin + Math.max(0, Math.min(1, (viewX - left) / plotWidth)) * (xMax - xMin);
    let nearest = 0;
    for (let candidate = 1; candidate < count; candidate++) {
      if (
        Math.abs(xTransform(chart.x[candidate]) - target) <
        Math.abs(xTransform(chart.x[nearest]) - target)
      )
        nearest = candidate;
    }
    onFocus();
    onPointChange(nearest);
  };

  return (
    <section
      className={'research-chart-card' + (active ? ' is-focused' : '')}
      style={{ '--research-accent': accent } as React.CSSProperties}
    >
      <div className="research-chart-heading">
        <button
          type="button"
          className="research-chart-focus"
          aria-pressed={active}
          onClick={onFocus}
        >
          <span className="research-eyebrow">{chart.id.replaceAll('-', ' ').toUpperCase()}</span>
          <strong>{chart.title}</strong>
        </button>
        <span className="research-chart-sample">
          {valid ? count + ' samples' : 'No finite samples'}
        </span>
      </div>
      <div className="research-chart-legend" aria-label="Chart legend">
        {chart.lines.map((line, lineIndex) => (
          <span key={line.label}>
            <i style={{ background: line.color || colors[lineIndex % colors.length] }} />
            {line.label}
          </span>
        ))}
      </div>
      {valid ? (
        <>
          <svg
            className="research-line-chart"
            viewBox={'0 0 ' + width + ' ' + height}
            role="img"
            aria-label={
              chart.title +
              '. Horizontal axis ' +
              chart.x_label +
              ', vertical axis ' +
              chart.y_label +
              '. ' +
              count +
              ' actual samples.'
            }
            onPointerMove={focusPointFromPointer}
            onPointerDown={focusPointFromPointer}
          >
            <title>
              {chart.title} · {chart.x_label} by {chart.y_label}
            </title>
            {yTickValues.map((value, tick) => (
              <g key={'y' + tick}>
                <path
                  d={'M' + left + ' ' + yPos(value) + 'H' + (left + plotWidth)}
                  className="research-chart-gridline"
                />
                <text x={left - 10} y={yPos(value) + 4} textAnchor="end">
                  {fmt(value, 3)}
                </text>
              </g>
            ))}
            {xTickPositions.map((value, tick) => {
              const xVal = xLog ? 10 ** value : value;
              return (
                <g key={'x' + tick}>
                  <path
                    d={'M' + (left + (tick / 4) * plotWidth) + ' ' + top + 'V' + (top + plotHeight)}
                    className="research-chart-gridline vertical"
                  />
                  <text
                    x={left + (tick / 4) * plotWidth}
                    y={height - 31}
                    textAnchor={tick === 0 ? 'start' : tick === 4 ? 'end' : 'middle'}
                  >
                    {fmt(xVal, 3)}
                  </text>
                </g>
              );
            })}
            <path
              d={'M' + left + ' ' + (top + plotHeight) + 'H' + (left + plotWidth)}
              className="research-chart-axis"
            />
            {xLog && (
              <text
                x={left + plotWidth}
                y={top + 11}
                textAnchor="end"
                className="research-chart-scale-note"
              >
                LOG X · POSITIVE FREQUENCIES
              </text>
            )}
            {chart.lines.map((line, lineIndex) => (
              <path
                key={line.label}
                d={pathFor(line.values)}
                fill="none"
                stroke={line.color || colors[lineIndex % colors.length]}
                strokeWidth={active ? 2.3 : 1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {active && Number.isFinite(xValue) && (!xLog || xValue > 0) && (
              <>
                <path
                  d={'M' + xPos(xValue) + ' ' + top + 'V' + (top + plotHeight)}
                  className="research-chart-crosshair"
                />
                {chart.lines.map((line, lineIndex) =>
                  Number.isFinite(lineAt(lineIndex)) ? (
                    <circle
                      key={line.label}
                      cx={xPos(xValue)}
                      cy={yPos(lineAt(lineIndex)!)}
                      r="4"
                      fill={line.color || colors[lineIndex % colors.length]}
                      className="research-chart-dot"
                    />
                  ) : null,
                )}
              </>
            )}
            <text
              transform={'rotate(-90 18 ' + (top + plotHeight / 2) + ')'}
              x="18"
              y={top + plotHeight / 2}
              textAnchor="middle"
              className="research-chart-axis-title"
            >
              {chart.y_label}
            </text>
            <text
              x={left + plotWidth / 2}
              y={height - 4}
              textAnchor="middle"
              className="research-chart-axis-title"
            >
              {chart.x_label}
            </text>
          </svg>
          {active && (
            <div className="research-chart-focus-readout" aria-live="polite">
              <label htmlFor={'research-index-' + cleanId}>Focus a data point</label>
              <input
                id={'research-index-' + cleanId}
                type="range"
                min="0"
                max={Math.max(0, count - 1)}
                step="1"
                value={index}
                aria-label={'Select sample on ' + chart.title}
                aria-valuetext={chart.x_label + ' ' + fmt(xValue, 6)}
                onFocus={onFocus}
                onChange={(event) => onPointChange(Number(event.target.value))}
              />
              <strong>
                {chart.x_label}: {fmt(xValue, 6)}
              </strong>
            </div>
          )}
          <div className="research-chart-values" aria-label="Selected sample values">
            {chart.lines.map((line, lineIndex) => (
              <span key={line.label}>
                <i style={{ background: line.color || colors[lineIndex % colors.length] }} />
                {line.label}:{' '}
                <b>
                  {Number.isFinite(lineAt(lineIndex))
                    ? fmt(lineAt(lineIndex)!, 7) + ' ' + chart.y_label
                    : 'Missing'}
                </b>
              </span>
            ))}
          </div>
          <details className="research-data-details">
            <summary>
              Data table <span>{count} x/y samples · full data in CSV</span>
            </summary>
            <div className="research-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{chart.x_label}</th>
                    {chart.lines.map((line) => (
                      <th key={line.label}>
                        {line.label} · {chart.y_label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: count }, (_, row) => (
                    <tr key={row} aria-current={active && row === index ? 'true' : undefined}>
                      <td>{fmt(chart.x[row], 7)}</td>
                      {chart.lines.map((line) => (
                        <td key={line.label}>
                          {Number.isFinite(line.values[row]) ? fmt(line.values[row], 8) : 'Missing'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="research-chart-empty">
          No plottable values were returned for this chart. Missing output is left explicit.
        </p>
      )}
    </section>
  );
}
