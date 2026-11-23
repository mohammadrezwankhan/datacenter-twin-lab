import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { dispatchJson, dispatchParsed } from '../src/javascript-worker';
import { catalogFixture, demoFixture } from './json-fixtures';

const root = resolve(process.cwd(), '../..');
const demoData = demoFixture(
  readFileSync(resolve(root, '.local/browser-demo-assets/demo-data.json'), 'utf8'),
);
const catalog = catalogFixture(
  readFileSync(resolve(root, '.local/browser-demo-assets/catalog.json'), 'utf8'),
);
const assets = { demoData, catalog };

function pythonExecutable(): string {
  const candidates = [
    process.env.TWIN_PYTHON,
    process.platform === 'win32'
      ? resolve(root, '.venv/Scripts/python.exe')
      : resolve(root, '.venv/bin/python'),
    process.platform === 'win32' ? 'python.exe' : 'python3',
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'print(1)'], { cwd: root, encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  throw new Error(
    'No Python interpreter found; set TWIN_PYTHON to run the required native differential harness.',
  );
}

function native(op: string, payload: unknown): unknown {
  const source = [
    'import json,sys',
    'sys.path.insert(0, sys.argv[1])',
    'op=sys.argv[2]',
    'payload=json.load(sys.stdin)',
    'from datacenter_twin.browser import dispatch_json',
    'if op=="dispatch": result=json.loads(dispatch_json(payload["path"], json.dumps(payload.get("body"), separators=(",",":"))))',
    'elif op=="planning":',
    ' from datacenter_twin.contracts import Scenario',
    ' from datacenter_twin.engine import simulate',
    ' result=simulate(Scenario.from_dict(payload))',
    'elif op=="quote":',
    ' from datacenter_twin.catalog import normalize_quote',
    ' result=normalize_quote(payload)',
    'elif op=="report":',
    ' from datacenter_twin.browser import scenario_report',
    ' result=scenario_report(payload)',
    'elif op=="sweep":',
    ' from datacenter_twin.browser import scenario_sweep',
    ' result=scenario_sweep(payload)',
    'else: raise ValueError(op)',
    'print(json.dumps(result,ensure_ascii=True,separators=(",",":")))',
  ].join('\n');
  const result = spawnSync(pythonExecutable(), ['-c', source, root, op], {
    input: JSON.stringify(payload),
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PYTHONUTF8: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(result.stderr || `Native Python failed (${String(result.status)})`);
  return JSON.parse(result.stdout);
}

void test('dispatcher covers fixed demo, catalog, simulation, sweep, report, planning, and quote routes', () => {
  assert.deepEqual(dispatchParsed('presets', null, assets), demoData.presets);
  assert.deepEqual(
    dispatchParsed('demo?preset=ai_cluster_generator_failure', null, assets),
    demoData.scenarios.ai_cluster_generator_failure,
  );
  assert.deepEqual(dispatchParsed('catalog', null, assets), catalog);
  const scenario = demoData.scenarios.generator_failure;
  assert.deepEqual(
    dispatchParsed('simulations', scenario, assets),
    native('dispatch', { path: 'simulations', body: scenario }),
  );
  assert.deepEqual(
    dispatchParsed(
      'sweeps',
      { scenario, parameter: 'battery_initial_kwh', values: ['100', '50', '0'] },
      assets,
    ),
    native('sweep', { scenario, parameter: 'battery_initial_kwh', values: ['100', '50', '0'] }),
  );
  const reportBody = { scenario, format: 'markdown' };
  assert.deepEqual(dispatchParsed('reports', reportBody, assets), native('report', reportBody));
  const htmlReportBody = { scenario, format: 'html' };
  assert.deepEqual(
    dispatchParsed('reports', htmlReportBody, assets),
    native('report', htmlReportBody),
  );
  const planning: unknown = JSON.parse(
    readFileSync(resolve(root, 'data/scenarios/baseline-1mw.json'), 'utf8'),
  );
  assert.deepEqual(dispatchParsed('planning', planning, assets), native('planning', planning));
  const quote = {
    offer_id: 'azure-nd-h100',
    node_count: 2,
    billed_hours: '3.5',
    assumed_rate: '98.32',
  };
  assert.deepEqual(dispatchParsed('quotes/normalize', quote, assets), native('quote', quote));
});

void test('worker simulation preserves decimal number tokens beyond binary precision', async () => {
  const exactDemand = '999999999999.000000001';
  const scenario = { ...demoData.scenarios.generator_failure, it_demand_kw: exactDemand };
  const body = JSON.stringify(scenario).replace(
    `"it_demand_kw":"${exactDemand}"`,
    `"it_demand_kw":${exactDemand}`,
  );
  assert.match(body, /"it_demand_kw":999999999999\.000000001/);
  assert.deepEqual(
    await dispatchJson('simulations', body, assets),
    dispatchParsed('simulations', scenario, assets),
  );
});

void test('worker rejects duplicate JSON keys and decimal schema-version tokens', async () => {
  const duplicate = '{"schema_version":2,"schema_version":2}';
  await assert.rejects(dispatchJson('simulations', duplicate, assets), /duplicate/i);

  const schema = JSON.stringify(demoData.scenarios.generator_failure).replace(
    '"schema_version":2',
    '"schema_version":2.0',
  );
  await assert.rejects(dispatchJson('simulations', schema, assets), /schema_version/i);

  const numericName = JSON.stringify(demoData.scenarios.generator_failure).replace(
    /"name":"[^"]*"/,
    '"name":123',
  );
  await assert.rejects(
    dispatchJson('simulations', numericName, assets),
    /name: expected nonempty text/i,
  );

  const unsafeId = JSON.stringify(demoData.scenarios.generator_failure).replace(
    /"id":"[^"]*"/,
    '"id":9007199254740993',
  );
  await assert.rejects(
    dispatchJson('simulations', unsafeId, assets),
    /id: expected nonempty text/i,
  );
});

void test('worker quote endpoint preserves decimal number tokens', async () => {
  const exactHours = '999999999999.000000001';
  const quote = {
    offer_id: 'azure-nd-h100',
    node_count: 2,
    billed_hours: exactHours,
    assumed_rate: '1',
  };
  const body = JSON.stringify(quote).replace(
    `"billed_hours":"${exactHours}"`,
    `"billed_hours":${exactHours}`,
  );
  assert.deepEqual(
    await dispatchJson('quotes/normalize', body, { catalog }),
    dispatchParsed('quotes/normalize', quote, { catalog }),
  );
});

void test('worker planning endpoint preserves decimal number tokens', async () => {
  const exactLoad = '999999999999.000000001';
  const planning = {
    schema_version: 1,
    id: 'exact-json-number',
    name: 'Exact JSON number',
    currency: 'USD',
    it_capacity_kw: '1',
    tariff_per_kwh: null,
    price_status: 'unknown',
    assumption_date: '2026-09-08',
    source_ids: ['TEST-001'],
    segments: [{ label: 'Test period', hours: '1', it_load_kw: exactLoad, assumed_pue: '1.25' }],
  };
  const body = JSON.stringify(planning).replace(
    `"it_load_kw":"${exactLoad}"`,
    `"it_load_kw":${exactLoad}`,
  );
  assert.deepEqual(
    await dispatchJson('planning', body, assets),
    dispatchParsed('planning', planning, assets),
  );
});

void test('worker sweeps preserve decimal and exponent number tokens without accepting booleans', async () => {
  const scenario = demoData.scenarios.generator_failure;
  const sweep = {
    scenario,
    parameter: 'battery_initial_kwh',
    values: ['1.25e+1', '12.500000001'],
  };
  const body = JSON.stringify(sweep)
    .replace('"1.25e+1"', '1.25e+1')
    .replace('"12.500000001"', '12.500000001');
  assert.deepEqual(
    await dispatchJson('sweeps', body, assets),
    dispatchParsed('sweeps', sweep, assets),
  );

  const booleanValue = JSON.stringify({ ...sweep, values: [true] });
  await assert.rejects(
    dispatchJson('sweeps', booleanValue, assets),
    /expected a finite decimal value/i,
  );
});

void test('worker strips one leading BOM and rejects an internal BOM', async () => {
  const scenario = demoData.scenarios.generator_failure;
  const serialized = JSON.stringify(scenario);
  assert.deepEqual(
    await dispatchJson('simulations', `\uFEFF${serialized}`, assets),
    dispatchParsed('simulations', scenario, assets),
  );

  const internalBom = `${serialized.slice(0, 1)}\uFEFF${serialized.slice(1)}`;
  await assert.rejects(dispatchJson('simulations', internalBom, assets), SyntaxError);
});
