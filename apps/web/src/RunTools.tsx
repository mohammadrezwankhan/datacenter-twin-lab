import { useEffect, useMemo, useRef, useState } from 'react';
import { n, request } from './client';
import type { Asset, Run } from './types';
import './scenario-comparison.css';

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type ComparisonParameter =
  'battery_initial_kwh' | 'generator_start_delay_s' | 'distribution_path_capacity_kw';

type ComparisonRow = {
  value: string;
  input_sha256: string;
  summary: Record<string, unknown>;
};

type Sweep = {
  base_run_id: string;
  base_input_sha256: string;
  parameter_unit: string;
  runs: ComparisonRow[];
  [key: string]: unknown;
};

type ComparisonView = {
  label: string;
  unit: string;
  sourceRunId: string;
  sourceInputSha256: string;
  rows: ComparisonRow[];
  artifact: unknown;
};

type ValueOption = { value: string; label: string };

function decimalMultiple(value: string, numerator: number, denominator = 1): string {
  const [whole, fraction = ''] = value.split('.');
  const extraPlaces = denominator === 2 ? 1 : 0;
  const scale = fraction.length + extraPlaces;
  const multiplier = (BigInt(numerator) * 10n ** BigInt(extraPlaces)) / BigInt(denominator);
  const amount = BigInt(`${whole}${fraction}`) * multiplier;
  if (!scale) return amount.toString();
  const digits = amount.toString().padStart(scale + 1, '0');
  const integer = digits.slice(0, -scale);
  const decimal = digits.slice(-scale).replace(/0+$/, '');
  return decimal ? `${integer}.${decimal}` : integer;
}

function uniqueOptions(options: ValueOption[]): ValueOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const numeric = Number(option.value);
    if (!Number.isFinite(numeric) || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function pathAvailableThroughEvents(asset: Asset, run: Run): boolean {
  const failedAssets = new Set(
    run.scenario.events
      .filter((event) => event.action === 'asset_down')
      .map((event) => event.target),
  );
  const failedDomains = new Set(
    run.scenario.events
      .filter((event) => event.action === 'domain_down')
      .map((event) => event.target),
  );
  return (
    !failedAssets.has(asset.id) &&
    !asset.failure_domains.some((domain) => failedDomains.has(domain))
  );
}

function summarize(run: Run): Record<string, unknown> {
  const summary = run.summary as Record<string, unknown>;
  const depleted = run.events.find((event) => event.action === 'battery_depleted');
  return {
    ...summary,
    requested_kwh: summary.requested_it_kwh,
    served_kwh: summary.served_it_kwh,
    unserved_kwh: summary.unserved_it_kwh,
    unserved_seconds: summary.unserved_duration_s,
    first_battery_depletion_s: depleted?.at_s ?? null,
  };
}

function MetricTable({
  label,
  unit,
  rows,
  id,
}: {
  label: string;
  unit: string;
  rows: ComparisonRow[];
  id?: string;
}) {
  return (
    <div
      className="scenario-comparison__table-wrap"
      tabIndex={0}
      aria-label="Scrollable comparison table"
    >
      <table data-testid={id}>
        <caption>One-at-a-time results for {label.toLowerCase()}</caption>
        <thead>
          <tr>
            <th scope="col">
              {label} ({unit})
            </th>
            <th scope="col">Requested IT energy (kWh)</th>
            <th scope="col">Served IT energy (kWh)</th>
            <th scope="col">Unserved IT energy (kWh)</th>
            <th scope="col">Interruption time (s)</th>
            <th scope="col">Battery depletion event</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const depletion = item.summary.first_battery_depletion_s;
            const noEvent = depletion === null || depletion === undefined;
            const noReserve = Number(item.summary.initial_battery_kwh) === 0;
            return (
              <tr key={item.value}>
                <th scope="row">{n(item.value, 3)}</th>
                <td>{n(item.summary.requested_kwh, 3)}</td>
                <td>{n(item.summary.served_kwh, 3)}</td>
                <td>{n(item.summary.unserved_kwh, 3)}</td>
                <td>{n(item.summary.unserved_seconds, 2)}</td>
                <td>
                  {noEvent
                    ? noReserve
                      ? 'No event; 0 kWh initial reserve'
                      : 'No depletion event'
                    : `${n(depletion, 2)} s`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function optionsFor(run: Run, parameter: ComparisonParameter, path?: Asset): ValueOption[] {
  if (parameter === 'battery_initial_kwh') {
    const capacity = run.scenario.battery_capacity_kwh;
    return uniqueOptions([
      { value: '0', label: '0 kWh' },
      {
        value: decimalMultiple(capacity, 1, 2),
        label: `Half capacity (${decimalMultiple(capacity, 1, 2)} kWh)`,
      },
      { value: capacity, label: `Full capacity (${capacity} kWh)` },
    ]);
  }
  if (parameter === 'generator_start_delay_s') {
    const configured = String(run.scenario.generator_start_delay_s);
    const candidates = uniqueOptions([
      { value: '0', label: '0 s' },
      { value: configured, label: `Configured delay (${configured} s)` },
      { value: '86400', label: '24 h maximum (86,400 s)' },
      { value: '43200', label: '12 h (43,200 s)' },
    ]);
    const preferred = [
      candidates.find((option) => option.value === '0'),
      candidates.find((option) => option.value === configured),
      candidates.find((option) => option.value === '86400'),
    ].filter((option): option is ValueOption => !!option);
    for (const option of candidates) {
      if (preferred.length >= 3) break;
      if (!preferred.some((item) => item.value === option.value)) preferred.push(option);
    }
    return preferred;
  }
  if (!path) return [];
  const low = decimalMultiple(path.capacity_kw, 1, 2);
  const high = decimalMultiple(path.capacity_kw, 3, 2);
  return uniqueOptions([
    { value: low, label: `Half of configured rating (${low} kW)` },
    { value: path.capacity_kw, label: `Configured rating (${path.capacity_kw} kW)` },
    { value: high, label: `1.5× configured rating (${high} kW)` },
  ]);
}

function initialSelection(
  run: Run,
  parameter: ComparisonParameter,
  options: ValueOption[],
  path?: Asset,
): string[] {
  if (parameter === 'battery_initial_kwh')
    return [options[0]?.value, options[1]?.value, options[2]?.value].filter(
      (value): value is string => value !== undefined,
    );
  if (parameter === 'generator_start_delay_s') {
    const preferred = ['0', String(run.scenario.generator_start_delay_s), '86400'];
    const values = preferred.filter(
      (value, index) =>
        options.some((option) => option.value === value) && preferred.indexOf(value) === index,
    );
    for (const option of options) {
      if (values.length >= 3) break;
      if (!values.includes(option.value)) values.push(option.value);
    }
    return values;
  }
  return path ? options.map((option) => option.value) : [];
}

export function RunTools({ run }: { run: Run }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sweep, setSweep] = useState<Sweep | null>(null);
  const [comparison, setComparison] = useState<ComparisonView | null>(null);
  const [parameter, setParameter] = useState<ComparisonParameter>('battery_initial_kwh');
  const [selectedPathId, setSelectedPathId] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const active = useRef<AbortController | null>(null);
  const runId = useRef(run.run_id);
  runId.current = run.run_id;

  const distributionAssets = run.scenario.assets.filter((asset) => asset.kind === 'distribution');
  const survivors = distributionAssets.filter((asset) => pathAvailableThroughEvents(asset, run));
  const candidatePaths = survivors.length ? survivors : distributionAssets;
  const path = candidatePaths.find((asset) => asset.id === selectedPathId) ?? candidatePaths[0];
  const options = useMemo(
    () => optionsFor(run, parameter, path),
    [run.run_id, parameter, path?.id, path?.capacity_kw],
  );

  useEffect(() => {
    setSweep(null);
    setComparison(null);
    setError('');
    setBusy(false);
    setSelectedPathId(survivors[0]?.id ?? distributionAssets[0]?.id ?? '');
    setSelectedValues(initialSelection(run, parameter, options, path));
    return () => active.current?.abort();
  }, [run.run_id]);

  useEffect(() => {
    setSelectedValues(initialSelection(run, parameter, options, path));
  }, [parameter, selectedPathId, run.run_id]);

  function clearResults() {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setError('');
    setSweep(null);
    setComparison(null);
  }

  async function calculate(format?: 'markdown' | 'html') {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const sourceRunId = run.run_id;
    setBusy(true);
    setError('');
    if (!format) {
      setSweep(null);
      setComparison(null);
    }
    try {
      if (format) {
        const report = await request<{ text: string; run_id: string }>(
          'reports',
          controller.signal,
          { scenario: run.scenario, format },
        );
        if (controller.signal.aborted || runId.current !== sourceRunId) return;
        download(
          report.text,
          `twin-report-${report.run_id.slice(0, 12)}.${format === 'html' ? 'html' : 'md'}`,
          format === 'html' ? 'text/html' : 'text/markdown',
        );
      } else {
        const capacity = run.scenario.battery_capacity_kwh;
        const values = uniqueOptions([
          { value: '0', label: '0' },
          { value: decimalMultiple(capacity, 1, 2), label: 'half' },
          { value: capacity, label: 'full' },
        ]).map((option) => option.value);
        const result = await request<Sweep>('sweeps', controller.signal, {
          scenario: run.scenario,
          parameter: 'battery_initial_kwh',
          values,
        });
        if (controller.signal.aborted || runId.current !== sourceRunId) return;
        setSweep(result);
      }
    } catch (e) {
      if (!controller.signal.aborted && runId.current === sourceRunId)
        setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted && runId.current === sourceRunId) {
        setBusy(false);
        if (active.current === controller) active.current = null;
      }
    }
  }

  async function compareAdvanced() {
    const values = [...new Set(selectedValues)];
    if (values.length < 2) {
      setError('Choose at least two distinct values to compare.');
      return;
    }
    if (parameter === 'distribution_path_capacity_kw' && !path) {
      setError('This scenario has no distribution path asset to compare.');
      return;
    }
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const sourceRunId = run.run_id;
    setBusy(true);
    setError('');
    setSweep(null);
    setComparison(null);
    const labels: Record<ComparisonParameter, string> = {
      battery_initial_kwh: 'Initial battery reserve',
      generator_start_delay_s: 'Generator start delay',
      distribution_path_capacity_kw: 'Surviving distribution path capacity',
    };
    const units: Record<ComparisonParameter, string> = {
      battery_initial_kwh: 'kWh',
      generator_start_delay_s: 's',
      distribution_path_capacity_kw: 'kW',
    };
    try {
      if (parameter !== 'distribution_path_capacity_kw') {
        const result = await request<Sweep>('sweeps', controller.signal, {
          scenario: run.scenario,
          parameter,
          values,
        });
        if (controller.signal.aborted || runId.current !== sourceRunId) return;
        setComparison({
          label: labels[parameter],
          unit: result.parameter_unit,
          sourceRunId: run.run_id,
          sourceInputSha256: run.input_sha256,
          rows: result.runs.map((row) => ({
            ...row,
            summary: {
              ...row.summary,
              initial_battery_kwh:
                parameter === 'battery_initial_kwh' ? row.value : run.scenario.battery_initial_kwh,
            },
          })),
          artifact: result,
        });
      } else {
        const results = await Promise.all(
          values.map(async (value) => {
            const scenario = structuredClone(run.scenario);
            scenario.assets = scenario.assets.map((asset) =>
              asset.id === path!.id ? { ...asset, capacity_kw: value } : asset,
            );
            const result = await request<Run>('simulations', controller.signal, scenario);
            return {
              value,
              value_label: `${value} kW`,
              value_unit: 'kW',
              run_id: result.run_id,
              input_sha256: result.input_sha256,
              summary: summarize(result),
              result,
            };
          }),
        );
        if (controller.signal.aborted || runId.current !== sourceRunId) return;
        const artifact = {
          schema_version: 2,
          model: 'single_load_electrical_continuity_distribution_path_capacity_comparison_v1',
          source_run_id: run.run_id,
          source_input_sha256: run.input_sha256,
          source_scenario: run.scenario,
          parameter: 'distribution_path_capacity_kw',
          parameter_unit: units.distribution_path_capacity_kw,
          target_asset: { id: path!.id, name: path!.name },
          values,
          runs: results,
          assumptions: [
            'Each candidate starts from the same validated source scenario.',
            'Only the selected distribution asset capacity changes; all other inputs remain fixed.',
          ],
          limitations: [
            'This is a deterministic synthetic comparison, not calibration or a forecast.',
            'A capacity change may have no effect when the selected path is unavailable or another source or IT limit dominates.',
            'Costs are not part of this comparison.',
          ],
        };
        setComparison({
          label: `${labels[parameter]} — ${path!.name}`,
          unit: units[parameter],
          sourceRunId: run.run_id,
          sourceInputSha256: run.input_sha256,
          rows: results.map((row) => ({
            ...row,
            summary: { ...row.summary, initial_battery_kwh: run.scenario.battery_initial_kwh },
          })),
          artifact,
        });
      }
    } catch (e) {
      if (!controller.signal.aborted && runId.current === sourceRunId)
        setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted && runId.current === sourceRunId) {
        setBusy(false);
        if (active.current === controller) active.current = null;
      }
    }
  }

  const comparisonParameter = parameter;
  const selectedValueCount = new Set(selectedValues).size;
  const customPathUnavailable = parameter === 'distribution_path_capacity_kw' && !path;

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
      <p
        className="scenario-comparison__status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {busy
          ? 'Preparing reproducible results…'
          : comparison
            ? `Comparison complete for ${comparison.label}.`
            : sweep
              ? 'Battery reserve comparison complete.'
              : ''}
      </p>
      {error && <p role="alert">{error}</p>}
      {sweep && (
        <div className="scenario-comparison__results" data-testid="battery-sweep">
          <p>
            Only initial stored energy changes: empty, half, and full capacity. Other inputs stay
            fixed.
          </p>
          <p className="scenario-comparison__hash">
            Source run <code>{run.run_id}</code> · input SHA-256: <code>{run.input_sha256}</code>
          </p>
          <MetricTable
            id="battery-sweep-table"
            label="Initial battery reserve"
            unit={sweep.parameter_unit}
            rows={sweep.runs.map((row) => ({
              ...row,
              summary: { ...row.summary, initial_battery_kwh: row.value },
            }))}
          />
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
      <details className="scenario-comparison" onToggle={() => setError('')}>
        <summary>Advanced scenario comparison</summary>
        <div className="scenario-comparison__body">
          <p>
            Each row changes one assumption from this completed run. The engine applies the same
            validated scenario and retains the other topology inputs.
          </p>
          <div className="scenario-comparison__controls">
            <label>
              Comparison assumption
              <select
                value={parameter}
                onChange={(event) => {
                  clearResults();
                  setParameter(event.target.value as ComparisonParameter);
                }}
              >
                <option value="battery_initial_kwh">Initial battery reserve</option>
                <option value="generator_start_delay_s">Generator start delay</option>
                <option value="distribution_path_capacity_kw">
                  Surviving distribution path capacity
                </option>
              </select>
            </label>
            {comparisonParameter === 'distribution_path_capacity_kw' && (
              <label>
                Distribution path to vary
                <select
                  value={path?.id ?? ''}
                  onChange={(event) => {
                    clearResults();
                    setSelectedPathId(event.target.value);
                  }}
                  disabled={!candidatePaths.length}
                >
                  {candidatePaths.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.id})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selectedValues.map((value, index) => (
              <label key={`${run.run_id}-${index}`}>
                Comparison value {index + 1} (
                {parameter === 'battery_initial_kwh'
                  ? 'kWh'
                  : parameter === 'generator_start_delay_s'
                    ? 's'
                    : 'kW'}
                )
                <select
                  value={value}
                  onChange={(event) => {
                    clearResults();
                    setSelectedValues((current) =>
                      current.map((item, position) =>
                        position === index ? event.target.value : item,
                      ),
                    );
                  }}
                >
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {!selectedValues.length && <p>No bounded values are available for this scenario.</p>}
            {selectedValues.length > 1 && selectedValueCount < 2 && (
              <p className="scenario-comparison__note">Choose at least two distinct values.</p>
            )}
          </div>
          {parameter === 'generator_start_delay_s' && (
            <p className="scenario-comparison__note">
              A delay can have no effect if the generator is unavailable for the event, or when
              another source or path constraint determines supply.
            </p>
          )}
          {parameter === 'distribution_path_capacity_kw' && (
            <p className="scenario-comparison__note">
              {customPathUnavailable
                ? 'This scenario has no distribution path asset to compare.'
                : survivors.length === 0
                  ? 'No distribution path is known to survive all modeled failure events. A capacity change may be irrelevant while the path is down.'
                  : 'A capacity change can have no effect when this path is unavailable or another source or IT limit dominates.'}
            </p>
          )}
          <button
            disabled={busy || selectedValueCount < 2 || customPathUnavailable}
            onClick={() => void compareAdvanced()}
          >
            Compare selected values
          </button>
        </div>
      </details>
      {comparison && (
        <div className="scenario-comparison__results" data-testid="scenario-comparison">
          <p className="scenario-comparison__hash">
            Source run <code>{comparison.sourceRunId}</code> · input SHA-256:{' '}
            <code>{comparison.sourceInputSha256}</code>
          </p>
          <MetricTable label={comparison.label} unit={comparison.unit} rows={comparison.rows} />
          <button
            onClick={() =>
              download(
                JSON.stringify(comparison.artifact, null, 2),
                `twin-comparison-${comparison.sourceInputSha256.slice(0, 12)}.json`,
                'application/json',
              )
            }
          >
            Download comparison JSON
          </button>
        </div>
      )}
    </section>
  );
}
