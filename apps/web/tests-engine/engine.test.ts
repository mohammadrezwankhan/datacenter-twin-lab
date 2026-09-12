import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  decimalText,
  moneyText,
  Rational,
  simulateContinuitySync,
  validateScenario,
} from '../src/js-engine/index';
import type { DemoData } from '../src/js-engine/index';

const root = resolve(process.cwd(), '../..');
const demoData = JSON.parse(
  readFileSync(resolve(root, '.local/browser-demo-assets/demo-data.json'), 'utf8'),
) as DemoData;

function preset(name: string): Record<string, unknown> {
  return structuredClone(demoData.scenarios[name]) as Record<string, unknown>;
}

test('exact arithmetic keeps Python-compatible decimal and money boundaries', () => {
  assert.equal(
    decimalText(new Rational(1n, 3n)),
    '0.3333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333',
  );
  assert.equal(decimalText(new Rational(1n, 2n)), '0.5');
  assert.equal(Rational.fromDecimal('１２.５').toDecimal(), '12.5');
  assert.equal(Rational.fromDecimal('١٢.٥').toDecimal(), '12.5');
  assert.equal(Rational.fromDecimal('1_2.5').toDecimal(), '12.5');
  assert.equal(moneyText(new Rational(1n, 200n)), '0.00');
  assert.equal(moneyText(new Rational(3n, 200n)), '0.02');
  assert.equal(moneyText(new Rational(5n, 200n)), '0.02');
});

test('seven public presets retain independent continuity expectations', () => {
  const normal = simulateContinuitySync(preset('normal'));
  assert.equal(normal.summary.served_it_kwh, '500');
  assert.equal(normal.summary.unserved_it_kwh, '0');
  const failure = simulateContinuitySync(preset('generator_failure'));
  assert.equal(failure.events.find((event) => event.action === 'battery_depleted')?.at_s, '607.8');
  assert.equal(failure.summary.unserved_duration_s, '292.2');
  const path = simulateContinuitySync(preset('path_maintenance'));
  const pathRow = path.intervals.find((row) => row.start_s === '300')!;
  assert.equal(pathRow.served_it_kw, '665');
  assert.equal(pathRow.unserved_it_kw, '335');
  const shared = simulateContinuitySync(preset('shared_domain'));
  assert.equal(shared.intervals.find((row) => row.start_s === '300')!.served_it_kw, '0');
  for (const name of demoData.presets.map((item) => item.id)) {
    const run = simulateContinuitySync(preset(name));
    for (const row of run.intervals) assert.equal(row.energy_balance_residual_kwh, '0');
  }
});

test('charging, depletion, demand events, partial paths, and unknown costs are explicit', () => {
  const empty = simulateContinuitySync({
    ...preset('generator_failure'),
    battery_initial_kwh: '0',
  });
  assert.equal(empty.events.find((event) => event.action === 'battery_depleted')?.at_s, '324.3675');
  const charged50 = simulateContinuitySync({
    ...preset('generator_failure'),
    battery_initial_kwh: '50',
  });
  assert.equal(
    charged50.events.find((event) => event.action === 'battery_depleted')?.at_s,
    '478.2675',
  );
  const deadline57 = simulateContinuitySync({
    ...preset('generator_failure'),
    duration_s: 600,
    battery_initial_kwh: '57',
    events: [
      { at_s: 300, action: 'asset_down', target: 'utility', value_kw: null },
      { at_s: 300, action: 'asset_down', target: 'generator', value_kw: null },
      { at_s: 500, action: 'asset_up', target: 'utility', value_kw: null },
      { at_s: 500, action: 'asset_up', target: 'generator', value_kw: null },
    ],
  });
  assert.equal(
    deadline57.events.find((event) => event.action === 'battery_depleted')?.at_s,
    '499.8135',
  );
  const changedDemand = simulateContinuitySync({
    ...preset('normal'),
    events: [{ at_s: 10, action: 'set_demand', target: 'it-load', value_kw: '500' }],
  });
  assert.equal(changedDemand.intervals.find((row) => row.start_s === '10')!.requested_it_kw, '500');
  const unknown = simulateContinuitySync({
    ...preset('utility_loss'),
    generator_cost_per_kwh: null,
  });
  assert.equal(unknown.summary.generator_energy_charge, null);
  assert.equal(unknown.summary.total_incremental_energy_charge, null);
  const coincident = simulateContinuitySync({
    ...preset('normal'),
    battery_initial_kwh: '99',
    battery_charge_efficiency: '1',
    step_s: 60,
  });
  assert.equal(coincident.intervals[0].end_s, '36');
  assert.equal(coincident.summary.battery_final_kwh, '100');
});

test('validation rejects bounded-contract violations and preserves arbitrary schema-2 topology', () => {
  assert.equal(validateScenario(preset('normal')).schema_version, 2);
  for (const patch of [
    { distribution_efficiency: '1.01' },
    { battery_initial_kwh: '101' },
    { duration_s: true },
    { duration_s: 86400, step_s: 1 },
    { schema_version: 1 },
    { tariff_per_kwh: 'NaN' },
    { it_demand_kw: '-1' },
    { currency: 'GBP' },
  ])
    assert.throws(() => validateScenario({ ...preset('normal'), ...patch }));
  const custom = structuredClone(preset('normal')) as Record<string, any>;
  custom.assets.push({
    id: 'extra-bus',
    name: 'Extra bus',
    kind: 'bus',
    capacity_kw: '100',
    failure_domains: ['extra'],
    source_ids: ['test'],
  });
  custom.dependencies.push({ source: 'main-bus', target: 'extra-bus', relation: 'requires' });
  assert.equal(validateScenario(custom).assets.length, 9);
});

function nativePython(payload: Record<string, unknown>): string | null {
  const source = [
    'import sys,json',
    'sys.path.insert(0, sys.argv[1])',
    'from datacenter_twin.topology import SiteScenario',
    'from datacenter_twin.continuity import simulate_continuity',
    'payload=json.load(sys.stdin)',
    'print(json.dumps({k:simulate_continuity(SiteScenario.from_dict(v)).to_dict() for k,v in payload.items()},separators=(",",":")))',
  ].join('\n');
  const candidates =
    process.platform === 'win32'
      ? [resolve(root, '.venv/Scripts/python.exe'), 'python.exe', 'python3.exe', 'py.exe']
      : [resolve(root, '.venv/bin/python'), 'python3', 'python'];
  candidates.unshift(process.env.TWIN_PYTHON);
  for (const executable of candidates.filter((value): value is string => Boolean(value))) {
    const result = spawnSync(executable, ['-c', source, root], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      cwd: root,
      env: { ...process.env, PYTHONUTF8: '1' },
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status === 0 && result.stdout) return result.stdout;
  }
  return null;
}

const presetCases = Object.fromEntries(demoData.presets.map(({ id }) => [id, preset(id)]));
const pythonOutput = nativePython(presetCases);
if (!pythonOutput)
  throw new Error(
    'Native Python differential harness unavailable; set TWIN_PYTHON to a Python 3.12+ interpreter.',
  );
test('complete run objects match native Python for all seven presets', () => {
  const expected = JSON.parse(pythonOutput!);
  for (const name of Object.keys(expected))
    assert.deepEqual(simulateContinuitySync(preset(name)), expected[name]);
});

const edgeCases: Record<string, unknown> = {
  battery_0: { ...preset('generator_failure'), battery_initial_kwh: '0' },
  battery_50: { ...preset('generator_failure'), battery_initial_kwh: '50' },
  battery_100: { ...preset('generator_failure'), battery_initial_kwh: '100' },
  decimal_efficiencies: {
    ...preset('generator_failure'),
    it_demand_kw: '123.456',
    distribution_efficiency: '0.9375',
    battery_charge_efficiency: '0.875',
    battery_discharge_efficiency: '0.8125',
    battery_initial_kwh: '12.345678901',
    generator_start_delay_s: 37,
    step_s: 60,
  },
  delayed_generator: { ...preset('utility_loss'), generator_start_delay_s: 37, step_s: 60 },
  demand_events: {
    ...preset('normal'),
    events: [
      { at_s: 10, action: 'set_demand', target: 'it-load', value_kw: '500' },
      { at_s: 20, action: 'set_demand', target: 'it-load', value_kw: '1200' },
    ],
  },
  charge_full_coincidence: {
    ...preset('normal'),
    battery_initial_kwh: '99',
    battery_charge_efficiency: '1',
    step_s: 60,
  },
  unknown_cost: { ...preset('utility_loss'), generator_cost_per_kwh: null },
  deadline_57: {
    ...preset('generator_failure'),
    duration_s: 600,
    battery_initial_kwh: '57',
    events: [
      { at_s: 300, action: 'asset_down', target: 'utility', value_kw: null },
      { at_s: 300, action: 'asset_down', target: 'generator', value_kw: null },
      { at_s: 500, action: 'asset_up', target: 'utility', value_kw: null },
      { at_s: 500, action: 'asset_up', target: 'generator', value_kw: null },
    ],
  },
  unicode_name: { ...preset('normal'), id: 'demo-unicode', name: 'λ😀 canonical ordering' },
  unicode_decimals: {
    ...preset('generator_failure'),
    it_demand_kw: '１２３.４５６',
    distribution_efficiency: '٠.٩٣٧٥',
    battery_charge_efficiency: '०.८७५',
    battery_discharge_efficiency: '0.8125',
    battery_initial_kwh: '１２.３４５６７８９０１',
    tariff_per_kwh: '0_17.5',
  },
  signed_zero: {
    ...preset('normal'),
    it_demand_kw: '-0',
    battery_initial_kwh: '-0.000000000',
    tariff_per_kwh: '-0',
    generator_cost_per_kwh: '-0',
  },
  long_unicode_name: { ...preset('normal'), name: '😀'.repeat(101) },
};
const unicodeIds = structuredClone(preset('normal')) as Record<string, any>;
const unicodeAssetIds = [
  '𐀀-utility',
  '-generator',
  'battery-🔋',
  'bus-λ',
  'distribution-東京',
  'distribution-😀',
  'bus-𐀀',
  'load-😀',
];
const unicodeByOriginal = new Map(
  unicodeIds.assets.map((asset: Record<string, string>, index: number) => [
    asset.id,
    unicodeAssetIds[index],
  ]),
);
unicodeIds.id = 'unicode-identifiers';
unicodeIds.name = 'non-BMP identifier ordering';
unicodeIds.source_ids = ['source-𐀀-😀'];
unicodeIds.assets = unicodeIds.assets.map((asset: Record<string, any>, index: number) => ({
  ...asset,
  id: unicodeAssetIds[index],
  source_ids: ['source-𐀀-😀'],
}));
unicodeIds.dependencies = unicodeIds.dependencies.map((edge: Record<string, string>) => ({
  ...edge,
  source: unicodeByOriginal.get(edge.source),
  target: unicodeByOriginal.get(edge.target),
}));
unicodeIds.events = unicodeIds.events.map((event: Record<string, any>) => ({
  ...event,
  target: unicodeByOriginal.get(event.target) ?? event.target,
}));
edgeCases.unicode_identifiers = unicodeIds;
const edgePythonOutput = nativePython(edgeCases);
if (!edgePythonOutput)
  throw new Error(
    'Native Python edge differential harness unavailable; set TWIN_PYTHON to a Python 3.12+ interpreter.',
  );
test('complete run objects match native Python for bounded edge scenarios', () => {
  const expected = JSON.parse(edgePythonOutput!);
  for (const name of Object.keys(expected))
    assert.deepEqual(simulateContinuitySync(edgeCases[name]), expected[name]);
});
