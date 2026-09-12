import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { dispatchParsed } from '../src/javascript-worker';
import type { DemoData } from '../src/js-engine/index';

const root = resolve(process.cwd(), '../..');
const demoData = JSON.parse(
  readFileSync(resolve(root, '.local/browser-demo-assets/demo-data.json'), 'utf8'),
) as DemoData;
const catalog = JSON.parse(
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

function native(op: string, payload: unknown): any {
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
    throw new Error(result.stderr || `Native Python failed (${result.status})`);
  return JSON.parse(result.stdout);
}

test('dispatcher covers fixed demo, catalog, simulation, sweep, report, planning, and quote routes', () => {
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
  const planning = JSON.parse(
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
