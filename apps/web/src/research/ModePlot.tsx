import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ResearchMode, ResearchResult } from './types';

const fmt = (value: number, digits = 3) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(
    value,
  );

export function ModePlot({ result, accent }: { result: ResearchResult; accent: string }) {
  const modes = result.modes ?? [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const validModes = useMemo(
    () => modes.filter((mode) => Number.isFinite(mode.real) && Number.isFinite(mode.imag)),
    [modes],
  );
  if (!validModes.length)
    return (
      <section className="research-result-card research-mode-card">
        <div className="research-section-heading">
          <div>
            <span className="research-eyebrow">POLE MAP</span>
            <h2>Modal locations</h2>
          </div>
        </div>
        <p className="research-muted">This result did not include finite eigenvalues to plot.</p>
      </section>
    );

  const selected = validModes[Math.min(selectedIndex, validModes.length - 1)];
  const width = 720;
  const height = 365;
  const left = 78;
  const right = 30;
  const top = 25;
  const bottom = 61;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const realMin = Math.min(0, ...validModes.map((mode) => mode.real));
  const realMax = Math.max(0, ...validModes.map((mode) => mode.real));
  const imagMin = Math.min(0, ...validModes.map((mode) => mode.imag));
  const imagMax = Math.max(0, ...validModes.map((mode) => mode.imag));
  const realSpan = Math.max(1e-9, realMax - realMin);
  const imagSpan = Math.max(1e-9, imagMax - imagMin);
  const xLow = realMin - realSpan * 0.12;
  const xHigh = realMax + realSpan * 0.12;
  const yLow = imagMin - imagSpan * 0.12;
  const yHigh = imagMax + imagSpan * 0.12;
  const x = (value: number) => left + ((value - xLow) / (xHigh - xLow)) * plotWidth;
  const y = (value: number) => top + ((yHigh - value) / (yHigh - yLow)) * plotHeight;
  const xZero = x(0);
  const yZero = y(0);
  const xticks = Array.from({ length: 5 }, (_, index) => xLow + (index / 4) * (xHigh - xLow));
  const yticks = Array.from({ length: 5 }, (_, index) => yHigh - (index / 4) * (yHigh - yLow));
  const selectFromKey = (event: KeyboardEvent<SVGGElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedIndex(index);
    }
  };

  return (
    <section
      className="research-result-card research-mode-card"
      style={{ '--research-accent': accent } as React.CSSProperties}
      aria-label="Eigenvalue pole map"
    >
      <div className="research-section-heading">
        <div>
          <span className="research-eyebrow">POLE MAP</span>
          <h2>Complex eigenvalues</h2>
        </div>
        <span className="research-chart-units">Real and imaginary parts · s⁻¹</span>
      </div>
      <p className="research-mode-intro">
        Select a pole to read its frequency, damping and dominant state. The zero-real axis is shown
        as a reference line; interpretation applies to this linearized operating point.
      </p>
      <svg
        className="research-mode-plot"
        viewBox={'0 0 ' + width + ' ' + height}
        role="group"
        aria-label="Scatter plot of eigenvalue real and imaginary parts, with zero axes."
      >
        <title>Model eigenvalues in the complex plane</title>
        <rect
          x={left}
          y={top}
          width={Math.max(0, xZero - left)}
          height={plotHeight}
          fill="#7db99a"
          opacity=".035"
        />
        <rect
          x={xZero}
          y={top}
          width={Math.max(0, left + plotWidth - xZero)}
          height={plotHeight}
          fill="#d78b91"
          opacity=".035"
        />
        {xticks.map((value, index) => (
          <g key={'x' + index}>
            <path
              d={'M' + x(value) + ' ' + top + 'V' + (top + plotHeight)}
              className="research-gridline"
            />
            <text x={x(value)} y={height - 31} textAnchor="middle">
              {fmt(value, 2)}
            </text>
          </g>
        ))}
        {yticks.map((value, index) => (
          <g key={'y' + index}>
            <path
              d={'M' + left + ' ' + y(value) + 'H' + (left + plotWidth)}
              className="research-gridline"
            />
            <text x={left - 10} y={y(value) + 4} textAnchor="end">
              {fmt(value, 2)}
            </text>
          </g>
        ))}
        <path
          d={'M' + xZero + ' ' + top + 'V' + (top + plotHeight)}
          className="research-zero-axis"
        />
        <path
          d={'M' + left + ' ' + yZero + 'H' + (left + plotWidth)}
          className="research-zero-axis"
        />
        {validModes.map((mode, index) => (
          <g
            key={index}
            className={'research-pole' + (index === selectedIndex ? ' is-selected' : '')}
            role="button"
            tabIndex={0}
            aria-label={
              'Mode ' +
              (index + 1) +
              ', real part ' +
              fmt(mode.real) +
              ' per second, imaginary part ' +
              fmt(mode.imag) +
              ' per second, frequency ' +
              fmt(mode.frequency_hz) +
              ' hertz.'
            }
            aria-pressed={index === selectedIndex}
            onClick={() => setSelectedIndex(index)}
            onKeyDown={(event) => selectFromKey(event, index)}
          >
            <title>
              {mode.dominant_state} · Re {fmt(mode.real)} · Im {fmt(mode.imag)} s⁻¹
            </title>
            <circle
              cx={x(mode.real)}
              cy={y(mode.imag)}
              r={index === selectedIndex ? 7 : 5}
              fill={index === selectedIndex ? '#fff' : accent}
              stroke={accent}
              strokeWidth="2"
            />
            <circle cx={x(mode.real)} cy={y(mode.imag)} r="12" fill="transparent" />
          </g>
        ))}
        <text
          transform={'rotate(-90 18 ' + (top + plotHeight / 2) + ')'}
          x="18"
          y={top + plotHeight / 2}
          textAnchor="middle"
          className="research-axis-title"
        >
          Imaginary part · s⁻¹
        </text>
        <text
          x={left + plotWidth / 2}
          y={height - 5}
          textAnchor="middle"
          className="research-axis-title"
        >
          Real part · s⁻¹
        </text>
        <text x={left + 7} y={top + 15} className="research-region-label">
          NEGATIVE REAL PART
        </text>
        <text x={xZero + 8} y={top + 15} className="research-region-label">
          POSITIVE REAL PART
        </text>
      </svg>
      <div className="research-mode-selected" aria-live="polite">
        <span style={{ background: accent }} />
        <strong>{selected.dominant_state}</strong>
        <span>Re {fmt(selected.real)} s⁻¹</span>
        <span>Im {fmt(selected.imag)} s⁻¹</span>
        <span>{fmt(selected.frequency_hz)} Hz</span>
        <span>
          {selected.damping === null
            ? 'Damping not reported'
            : 'Damping ' + fmt(selected.damping, 4)}
        </span>
      </div>
      <details className="research-data-details">
        <summary>
          Mode table <span>{validModes.length} eigenvalues · select a row to focus its marker</span>
        </summary>
        <div className="research-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mode</th>
                <th>Re · s⁻¹</th>
                <th>Im · s⁻¹</th>
                <th>Frequency · Hz</th>
                <th>Damping</th>
                <th>Dominant state</th>
              </tr>
            </thead>
            <tbody>
              {validModes.map((mode: ResearchMode, index) => (
                <tr key={index}>
                  <td>
                    <button
                      type="button"
                      className="research-mode-row"
                      aria-pressed={index === selectedIndex}
                      onClick={() => setSelectedIndex(index)}
                    >
                      {index + 1}
                    </button>
                  </td>
                  <td>{fmt(mode.real, 5)}</td>
                  <td>{fmt(mode.imag, 5)}</td>
                  <td>{fmt(mode.frequency_hz, 5)}</td>
                  <td>{mode.damping === null ? 'Not reported' : fmt(mode.damping, 5)}</td>
                  <td>{mode.dominant_state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
