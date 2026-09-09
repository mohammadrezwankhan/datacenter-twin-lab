import { useEffect, useRef, useState } from 'react';
import { n, request } from './client';
import type { Run } from './types';

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Sweep = {
  base_input_sha256: string;
  parameter_unit: string;
  runs: { value: string; input_sha256: string; summary: Record<string, unknown> }[];
};

export function RunTools({ run }: { run: Run }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sweep, setSweep] = useState<Sweep | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    setSweep(null);
    setError('');
    setBusy(false);
    return () => active.current?.abort();
  }, [run.run_id]);

  async function calculate(format?: 'markdown' | 'html') {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      if (format) {
        const report = await request<{ text: string; run_id: string }>(
          'reports',
          controller.signal,
          {
            scenario: run.scenario,
            format,
          },
        );
        download(
          report.text,
          `twin-report-${report.run_id.slice(0, 12)}.${format === 'html' ? 'html' : 'md'}`,
          format === 'html' ? 'text/html' : 'text/markdown',
        );
      } else {
        const capacity = Number(run.scenario.battery_capacity_kwh);
        const values = [...new Set(['0', String(capacity / 2), String(capacity)])];
        const result = await request<Sweep>('sweeps', controller.signal, {
          scenario: run.scenario,
          parameter: 'battery_initial_kwh',
          values,
        });
        setSweep(result);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <section className="panel run-tools" aria-label="Reports and sensitivity">
      <div className="section-title">
        <div>
          <h2>Share the calculation</h2>
          <p>
            Reports use the completed run, including its assumptions, input hash, and unknown costs.
          </p>
        </div>
      </div>
      <div className="tool-actions">
        <button disabled={busy} onClick={() => void calculate('markdown')}>
          Download Markdown report
        </button>
        <button disabled={busy} onClick={() => void calculate('html')}>
          Download HTML report
        </button>
        <button disabled={busy} onClick={() => void calculate()}>
          Compare battery reserves
        </button>
      </div>
      {busy && <p role="status">Preparing reproducible results…</p>}
      {error && <p role="alert">{error}</p>}
      {sweep && (
        <div className="table-scroll" data-testid="battery-sweep">
          <p>
            Only initial stored energy changes: empty, half, and full capacity. Other inputs stay
            fixed.
          </p>
          <table>
            <thead>
              <tr>
                <th>Initial battery (kWh)</th>
                <th>Unserved IT energy (kWh)</th>
                <th>Unserved time (s)</th>
                <th>Depletion at (s)</th>
              </tr>
            </thead>
            <tbody>
              {sweep.runs.map((item) => (
                <tr key={item.value}>
                  <td>{n(item.value, 2)}</td>
                  <td>{n(item.summary.unserved_kwh, 3)}</td>
                  <td>{n(item.summary.unserved_seconds, 2)}</td>
                  <td>
                    {item.summary.first_battery_depletion_s === null
                      ? 'No depletion event'
                      : n(item.summary.first_battery_depletion_s, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() =>
              download(
                JSON.stringify(sweep, null, 2),
                `twin-sweep-${sweep.base_input_sha256.slice(0, 12)}.json`,
                'application/json',
              )
            }
          >
            Download sensitivity JSON
          </button>
        </div>
      )}
    </section>
  );
}
