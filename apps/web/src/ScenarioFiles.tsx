import { useEffect, useRef, useState } from 'react';
import type { SiteScenario } from './types';
import './scenario-files.css';

const maximumFileBytes = 10 * 1024 * 1024;
type Preview = { name: string; scenario: SiteScenario; fromRun: boolean };
const labels: Record<keyof SiteScenario, string> = {
  schema_version: 'Scenario schema',
  id: 'Scenario identifier',
  name: 'Scenario name',
  currency: 'Currency',
  duration_s: 'Duration (s)',
  step_s: 'Nominal interval (s)',
  it_demand_kw: 'IT demand (kW)',
  it_capacity_kw: 'IT capacity (kW)',
  distribution_efficiency: 'Distribution efficiency (ratio)',
  tariff_per_kwh: 'Grid tariff (currency/kWh)',
  generator_cost_per_kwh: 'Generator cost (currency/kWh)',
  generator_start_delay_s: 'Generator startup delay (s)',
  battery_capacity_kwh: 'Battery capacity (kWh)',
  battery_initial_kwh: 'Opening battery energy (kWh)',
  battery_charge_kw: 'Charging limit (kW)',
  battery_charge_efficiency: 'Charging efficiency (ratio)',
  battery_discharge_efficiency: 'Discharge efficiency (ratio)',
  source_ids: 'Source identifiers',
  assets: 'Assets and ratings',
  dependencies: 'Connections and dependencies',
  events: 'Scheduled events',
};

function Value({ value }: { value: SiteScenario[keyof SiteScenario] }) {
  if (value === null) return <>Unknown</>;
  if (!Array.isArray(value)) return <>{String(value)}</>;
  if (!value.length) return <>None</>;
  return (
    <details>
      <summary>{value.length} entries — inspect</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

export function ScenarioFiles({
  current,
  busy,
  onRun,
}: {
  current: SiteScenario;
  busy: boolean;
  onRun: (scenario: SiteScenario) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(0);
  const fileInput = useRef<HTMLInputElement | null>(null);

  function clear() {
    operation.current += 1;
    setPreview(null);
    setReading(false);
    setError('');
    if (fileInput.current) fileInput.current.value = '';
  }

  // A late file read must never replace a newer draft, preset, or file selection.
  useEffect(() => {
    clear();
    return () => {
      operation.current += 1;
    };
  }, [current]);

  async function readFile(file: File) {
    const ticket = ++operation.current;
    setPreview(null);
    setError('');
    setReading(true);
    try {
      if (file.size > maximumFileBytes)
        throw new Error(
          'Choose a JSON file of at most 10 MiB. Export only the scenario for a larger run.',
        );
      const text = await file.text();
      let document: unknown;
      try {
        document = JSON.parse(text.replace(/^\uFEFF/, ''));
      } catch {
        throw new Error(
          'This file is not valid JSON. Choose a scenario or an exported electrical run.',
        );
      }
      if (!document || typeof document !== 'object' || Array.isArray(document))
        throw new Error('Choose a scenario object or an exported electrical run.');
      let data = document as Record<string, unknown>;
      // The CLI wraps its electrical run with an export timestamp.
      if (typeof data.generated_at_utc === 'string' && Object.hasOwn(data, 'result')) {
        if (!data.result || typeof data.result !== 'object' || Array.isArray(data.result))
          throw new Error('The CLI export does not contain an electrical run.');
        data = data.result as Record<string, unknown>;
      }
      if (data.schema_version !== 2)
        throw new Error(
          'Choose an electrical continuity file (schema 2). PUE planning uses a different model.',
        );
      const fromRun = Object.hasOwn(data, 'scenario');
      if (fromRun && (typeof data.run_id !== 'string' || !Array.isArray(data.intervals)))
        throw new Error('This is not a recognized run export. Choose its scenario JSON instead.');
      // Load the existing engine contract only when a visitor chooses a file.
      // Imported result rows and hashes are never trusted or displayed as a new run.
      const { validateScenario } = await import('./js-engine/contract');
      const scenario = validateScenario(fromRun ? data.scenario : data);
      if (ticket === operation.current) setPreview({ name: file.name, scenario, fromRun });
    } catch (cause) {
      if (ticket === operation.current) setError((cause as Error).message);
    } finally {
      if (ticket === operation.current) setReading(false);
    }
  }

  async function downloadScenario() {
    setError('');
    try {
      const { validateScenario } = await import('./js-engine/contract');
      const scenario = validateScenario(current);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(scenario, null, 2) + '\n'], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'twin-scenario.json';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(`Cannot export these draft inputs: ${(cause as Error).message}`);
    }
  }

  const changes = preview
    ? (Object.keys(labels) as (keyof SiteScenario)[]).filter(
        (key) => JSON.stringify(current[key]) !== JSON.stringify(preview.scenario[key]),
      )
    : [];

  return (
    <section className="panel scenario-files" aria-label="Scenario files" id="scenario-files">
      <h2>Open a saved experiment</h2>
      <p>
        Choose a scenario JSON or exported electrical run, review the assumptions, then calculate.
        The file is read on this device. No calculation runs until you choose to run it.
      </p>
      <div className="scenario-file-actions">
        <label>
          Scenario JSON file (up to 10 MiB)
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </label>
        <button disabled={busy || reading} onClick={() => void downloadScenario()}>
          Download current scenario
        </button>
      </div>
      {reading && <p role="status">Reading and validating the scenario…</p>}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {preview && (
        <div className="scenario-file-preview" data-testid="scenario-file-preview">
          <p role="status">
            Ready to run: <strong>{preview.scenario.name}</strong> from {preview.name}.
          </p>
          {preview.fromRun && (
            <p>
              Only the saved inputs are imported. Results and hashes will be recalculated by this
              engine.
            </p>
          )}
          <p>
            {changes.length
              ? `${changes.length} input fields differ from the current draft. Running this file replaces that draft.`
              : 'The validated inputs match the current draft.'}
          </p>
          {changes.length > 0 && (
            <div
              className="scenario-file-table"
              role="region"
              aria-label="Imported assumption changes"
              tabIndex={0}
            >
              <table>
                <caption>Review the changes before running</caption>
                <thead>
                  <tr>
                    <th scope="col">Input</th>
                    <th scope="col">Current draft</th>
                    <th scope="col">From file</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((key) => (
                    <tr key={key}>
                      <th scope="row">{labels[key]}</th>
                      <td>
                        <Value value={current[key]} />
                      </td>
                      <td>
                        <Value value={preview.scenario[key]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="scenario-file-actions">
            <button
              className="primary"
              disabled={busy || reading}
              onClick={() => onRun(preview.scenario)}
            >
              Run imported scenario
            </button>
            <button disabled={busy} onClick={clear}>
              Discard import
            </button>
          </div>
          <p className="scenario-file-note">
            Source identifiers are preserved as supplied; importing does not verify their
            provenance. Save the scenario or run JSON to keep it after reloading the page.
          </p>
        </div>
      )}
    </section>
  );
}
