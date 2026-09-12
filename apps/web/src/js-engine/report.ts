import { compareUnicode } from './canonical';
import { InputError } from './decimal';

function pyString(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (Array.isArray(value)) return `[${value.map(pyString).join(', ')}]`;
  if (typeof value === 'object') return '[object Object]';
  return String(value);
}

function md(value: unknown): string {
  let text = value === null || value === undefined ? '' : pyString(value);
  text = text.replaceAll('\r\n', ' ').replaceAll('\n', ' ').replaceAll('\r', ' ');
  text = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  for (const character of [
    '\\',
    '|',
    '`',
    '*',
    '_',
    '[',
    ']',
    '(',
    ')',
    '#',
    '!',
    '>',
    '+',
    '-',
    '~',
  ])
    text = text.replaceAll(character, `\\${character}`);
  return text;
}

function html(value: unknown): string {
  return pyString(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function object(value: unknown, name: string): Record<string, any> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new InputError(`${name}: expected an object`);
  return value as Record<string, any>;
}

function requireResult(result: unknown): Record<string, any> {
  const value = object(result, 'Report result');
  if (!object(value.scenario ?? value.base_scenario, 'Report result'))
    throw new InputError('Report result must include a scenario');
  if (
    !Object.prototype.hasOwnProperty.call(value, 'summary') &&
    !(
      Object.prototype.hasOwnProperty.call(value, 'runs') &&
      Object.prototype.hasOwnProperty.call(value, 'parameter')
    )
  )
    throw new InputError('Report result must be a continuity run or sensitivity sweep');
  return value;
}

function scenario(result: Record<string, any>): Record<string, any> {
  return result.scenario || result.base_scenario || {};
}

function scenarioRows(input: Record<string, any>): [string, string, string][] {
  const units: Record<string, string> = {
    duration_s: 's',
    step_s: 's',
    it_demand_kw: 'kW',
    it_capacity_kw: 'kW',
    distribution_efficiency: 'ratio',
    generator_start_delay_s: 's',
    battery_capacity_kwh: 'kWh',
    battery_initial_kwh: 'kWh',
    battery_charge_kw: 'kW',
    battery_charge_efficiency: 'ratio',
    battery_discharge_efficiency: 'ratio',
    tariff_per_kwh: 'currency/kWh',
    generator_cost_per_kwh: 'currency/kWh',
  };
  const keys = [
    'id',
    'name',
    'currency',
    'duration_s',
    'step_s',
    'it_demand_kw',
    'it_capacity_kw',
    'distribution_efficiency',
    'generator_start_delay_s',
    'battery_capacity_kwh',
    'battery_initial_kwh',
    'battery_charge_kw',
    'battery_charge_efficiency',
    'battery_discharge_efficiency',
    'tariff_per_kwh',
    'generator_cost_per_kwh',
  ];
  return keys.map((key) => [
    key,
    pyString(Object.prototype.hasOwnProperty.call(input, key) ? input[key] : 'unknown'),
    units[key] || '',
  ]);
}

function warnings(run: Record<string, any>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const interval of run.intervals || [])
    for (const warning of interval.warnings || [])
      counts.set(String(warning), (counts.get(String(warning)) || 0) + 1);
  return counts;
}

function singleSummary(result: Record<string, any>): Record<string, any> {
  const summary = { ...(result.summary || {}) };
  summary.requested_kwh ??= summary.requested_it_kwh ?? 'unknown';
  summary.served_kwh ??= summary.served_it_kwh ?? 'unknown';
  summary.unserved_kwh ??= summary.unserved_it_kwh ?? 'unknown';
  summary.unserved_seconds ??= summary.unserved_duration_s ?? 'unknown';
  summary.first_battery_depletion_s ??=
    (result.events || []).find((event: any) => event.action === 'battery_depleted')?.at_s ?? null;
  summary.cost_unknowns ??= ['generator_energy_charge', 'total_incremental_energy_charge'].filter(
    (key) => summary[key] === null,
  );
  return summary;
}

function summaryRows(summary: Record<string, any>): [string, unknown, string][] {
  const depletion = summary.first_battery_depletion_s;
  return [
    ['Requested IT energy', summary.requested_kwh ?? 'unknown', 'kWh'],
    ['Served IT energy', summary.served_kwh ?? 'unknown', 'kWh'],
    ['Unserved IT energy', summary.unserved_kwh ?? 'unknown', 'kWh'],
    ['Unserved duration', summary.unserved_seconds ?? 'unknown', 's'],
    [
      'First battery depletion',
      depletion === null || depletion === undefined ? 'none' : depletion,
      's',
    ],
    ['Battery final energy', summary.battery_final_kwh ?? 'unknown', 'kWh'],
    ['Peak unserved demand', summary.peak_unserved_kw ?? 'unknown', 'kW'],
    ['Service status', summary.service_status ?? 'unknown', ''],
    ['Cost status', summary.cost_status ?? 'unknown', ''],
    ['Cost unknowns', (summary.cost_unknowns || []).join(', ') || 'none', ''],
    ['Energy balance residual', summary.energy_balance_residual_kwh ?? 'unknown', 'kWh'],
  ];
}

function markdownTable(headers: string[], rows: unknown[][]): string[] {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  lines.push(...rows.map((row) => `| ${row.map(md).join(' | ')} |`));
  return lines;
}

function eventRows(result: Record<string, any>): unknown[][] {
  return (result.events || []).map((event: any) => [
    event.at_s ?? 'unknown',
    event.action ?? 'unknown',
    event.target ?? 'unknown',
    event.origin ?? 'scenario',
    event.ready_at_s ?? '',
  ]);
}

function sweepRows(result: Record<string, any>): { rows: unknown[][]; warningLines: string[] } {
  const rows: unknown[][] = [];
  const counts = new Map<string, number>();
  for (const entry of result.runs || []) {
    const summary = entry.summary || {};
    rows.push([
      entry.value_label ?? entry.value ?? 'unknown',
      summary.requested_kwh ?? summary.requested_it_kwh ?? 'unknown',
      summary.served_kwh ?? summary.served_it_kwh ?? 'unknown',
      summary.unserved_kwh ?? summary.unserved_it_kwh ?? 'unknown',
      summary.unserved_seconds ?? summary.unserved_duration_s ?? 'unknown',
      summary.first_battery_depletion_s === null || summary.first_battery_depletion_s === undefined
        ? 'none'
        : summary.first_battery_depletion_s,
      summary.service_status ?? 'unknown',
      (summary.cost_unknowns || []).join(', ') || 'none',
      entry.run_id ?? 'unknown',
      entry.input_sha256 ?? 'unknown',
    ]);
    if (entry.result)
      for (const [name, count] of warnings(entry.result))
        counts.set(name, (counts.get(name) || 0) + count);
    else
      for (const [name, count] of Object.entries(summary.warning_counts || {}))
        counts.set(String(name), (counts.get(String(name)) || 0) + Number(count));
  }
  return {
    rows,
    warningLines: Array.from(counts)
      .sort(([left], [right]) => compareUnicode(left, right))
      .map(([name, count]) => `${name}: ${count} interval(s)`),
  };
}

export function renderMarkdown(input: unknown): string {
  const result = requireResult(input);
  const sweep =
    Object.prototype.hasOwnProperty.call(result, 'runs') &&
    Object.prototype.hasOwnProperty.call(result, 'parameter');
  const currentScenario = scenario(result);
  const lines = [
    '# Datacenter Twin Lab continuity report',
    '',
    `Model: ${md(result.model ?? 'unknown')}`,
    `Engine version: ${md(result.engine_version ?? 'unknown')}`,
  ];
  let warningLines: string[];
  if (sweep) {
    lines.push(
      `Base input SHA-256: ${md(result.base_input_sha256 ?? 'unknown')}`,
      `Parameter: ${md(result.parameter ?? 'unknown')} (${md(result.parameter_unit ?? '')})`,
      '',
      '## Sensitivity outcomes',
      '',
    );
    const rows = sweepRows(result);
    warningLines = rows.warningLines;
    lines.push(
      ...markdownTable(
        [
          'Value',
          'Requested (kWh)',
          'Served (kWh)',
          'Unserved (kWh)',
          'Unserved (s)',
          'Battery depletion (s)',
          'Service',
          'Cost unknowns',
          'Run ID',
          'Input SHA-256',
        ],
        rows.rows,
      ),
    );
  } else {
    lines.push(
      `Run ID: ${md(result.run_id ?? 'unknown')}`,
      `Input SHA-256: ${md(result.input_sha256 ?? 'unknown')}`,
      '',
      '## Outcome',
      '',
    );
    lines.push(...markdownTable(['Measure', 'Value', 'Unit'], summaryRows(singleSummary(result))));
    lines.push('', '## Event timeline', '');
    const rows = eventRows(result);
    lines.push(
      ...(rows.length
        ? markdownTable(['At (s)', 'Action', 'Target', 'Origin', 'Ready at (s)'], rows)
        : ['No events were emitted.']),
    );
    warningLines = Array.from(warnings(result))
      .sort(([left], [right]) => compareUnicode(left, right))
      .map(([name, count]) => `${name}: ${count} interval(s)`);
  }
  lines.push(
    '',
    '## Scenario assumptions',
    '',
    ...markdownTable(['Field', 'Value', 'Unit'], scenarioRows(currentScenario)),
    '',
    '## Warning summary',
    '',
    ...(warningLines.length
      ? markdownTable(
          ['Warning', 'Count'],
          warningLines.map((item) => item.split(/: (?=\d+ interval)/)),
        )
      : ['No interval warnings were emitted.']),
  );
  if (sweep)
    lines.push('', `Full per-run results included: ${md(result.full_results_included ?? false)}`);
  lines.push(
    '',
    '## Assumptions',
    '',
    ...(result.assumptions || []).map((item: unknown) => `- ${md(item)}`),
    '',
    '## Limitations',
    '',
    ...(result.limitations || []).map((item: unknown) => `- ${md(item)}`),
  );
  return `${lines.join('\n')}\n`;
}

function htmlTable(headers: string[], rows: unknown[][]): string {
  const head = headers.map((value) => `<th>${html(value)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((value) => `<td>${html(value)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function renderHtml(input: unknown): string {
  const result = requireResult(input);
  const sweep =
    Object.prototype.hasOwnProperty.call(result, 'runs') &&
    Object.prototype.hasOwnProperty.call(result, 'parameter');
  const currentScenario = scenario(result);
  const title = 'Datacenter Twin Lab continuity report';
  const parts = [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>Datacenter Twin Lab continuity report</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse;margin:1rem 0;width:100%}th,td{border:1px solid #ccc;padding:.35rem;text-align:left}th{background:#f2f2f2}code{word-break:break-all}</style></head><body>',
    `<h1>${html(title)}</h1>`,
    `<p>Model: <code>${html(result.model ?? 'unknown')}</code><br>Engine version: <code>${html(result.engine_version ?? 'unknown')}</code></p>`,
  ];
  let warningLines: string[];
  if (sweep) {
    parts.push(
      `<p>Base input SHA-256: <code>${html(result.base_input_sha256 ?? 'unknown')}</code><br>Parameter: <code>${html(result.parameter ?? 'unknown')}</code> (${html(result.parameter_unit ?? '')})</p>`,
    );
    const rows = sweepRows(result);
    warningLines = rows.warningLines;
    parts.push(
      '<h2>Sensitivity outcomes</h2>',
      htmlTable(
        [
          'Value',
          'Requested (kWh)',
          'Served (kWh)',
          'Unserved (kWh)',
          'Unserved (s)',
          'Battery depletion (s)',
          'Service',
          'Cost unknowns',
          'Run ID',
          'Input SHA-256',
        ],
        rows.rows,
      ),
    );
  } else {
    parts.push(
      `<p>Run ID: <code>${html(result.run_id ?? 'unknown')}</code><br>Input SHA-256: <code>${html(result.input_sha256 ?? 'unknown')}</code></p>`,
      '<h2>Outcome</h2>',
      htmlTable(['Measure', 'Value', 'Unit'], summaryRows(singleSummary(result))),
      '<h2>Event timeline</h2>',
    );
    const rows = eventRows(result);
    parts.push(
      rows.length
        ? htmlTable(['At (s)', 'Action', 'Target', 'Origin', 'Ready at (s)'], rows)
        : '<p>No events were emitted.</p>',
    );
    warningLines = Array.from(warnings(result))
      .sort(([left], [right]) => compareUnicode(left, right))
      .map(([name, count]) => `${name}: ${count} interval(s)`);
  }
  parts.push(
    '<h2>Scenario assumptions</h2>',
    htmlTable(['Field', 'Value', 'Unit'], scenarioRows(currentScenario)),
    '<h2>Warning summary</h2>',
    warningLines.length
      ? htmlTable(
          ['Warning', 'Count'],
          warningLines.map((item) => item.split(/: (?=\d+ interval)/)),
        )
      : '<p>No interval warnings were emitted.</p>',
  );
  if (sweep)
    parts.push(
      `<p>Full per-run results included: ${html(result.full_results_included ?? false)}</p>`,
    );
  for (const [heading, key] of [
    ['Assumptions', 'assumptions'],
    ['Limitations', 'limitations'],
  ] as const)
    parts.push(
      `<h2>${heading}</h2>`,
      `<ul>${(result[key] || []).map((item: unknown) => `<li>${html(item)}</li>`).join('')}</ul>`,
    );
  parts.push('</body>', '</html>');
  return `${parts.join('\n')}\n`;
}
