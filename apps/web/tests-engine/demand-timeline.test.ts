import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  demandDraft,
  demandPreview,
  nextStepTime,
  scenarioWithDemand,
} from '../src/demand-timeline';
import { simulateContinuitySync } from '../src/js-engine/continuity';
import type { SiteScenario } from '../src/types';

const root = resolve(process.cwd(), '../..');
const data = JSON.parse(
  readFileSync(resolve(root, '.local/browser-demo-assets/demo-data.json'), 'utf8'),
);
const base = data.scenarios.normal as SiteScenario;
const step = (atS: string, demandKw: string, id = 'new') => ({
  id,
  atS,
  demandKw,
  originalIndex: null,
});
function assertNative(scenario: SiteScenario) {
  const native = JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      [
        '-c',
        'import json,sys;from datacenter_twin.topology import SiteScenario;from datacenter_twin.continuity import simulate_continuity;print(json.dumps(simulate_continuity(SiteScenario.from_dict(json.load(sys.stdin))).to_dict()))',
      ],
      { input: JSON.stringify(scenario), cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    ),
  );
  const result = simulateContinuitySync(scenario);
  assert.deepEqual(result, native);
  assert.equal(demandPreview(scenario).requestedKwh, result.summary.requested_it_kwh);
  return result;
}

test('all eighteen demand schedules round-trip without changing a field or event order', () => {
  for (const scenario of Object.values(data.scenarios) as SiteScenario[]) {
    assert.deepEqual(scenarioWithDemand(scenario, demandDraft(scenario)), scenario);
  }
});

test('demand preview integrates zero-time, equal-time and last-second steps with native parity', () => {
  const scenario = scenarioWithDemand(
    { ...base, duration_s: 3600, it_demand_kw: '999', tariff_per_kwh: null },
    {
      initialKw: '999',
      steps: [
        step('0', '1000'),
        step('1800', '900', 'second'),
        step('1800', '500', 'third'),
        step('3599', '0', 'last'),
      ],
    },
  );
  // 1000 kW for 1800 s, 500 kW for 1799 s, zero for the final second.
  const expected = 500 + (500 * 1799) / 3600;
  const result = assertNative(scenario);
  assert.ok(Math.abs(Number(result.summary.requested_it_kwh) - expected) < 1e-10);
  assert.equal(result.summary.grid_energy_charge, null);
  assert.deepEqual(demandPreview(scenario).segments, [
    { start: 0, end: 1800, kw: '1000' },
    { start: 1800, end: 3599, kw: '500' },
    { start: 3599, end: 3600, kw: '0' },
  ]);
});

test('edits preserve non-demand events, custom load ids, precision and coincident outage behavior', () => {
  const source = structuredClone(data.scenarios.generator_failure) as SiteScenario;
  const oldLoad = source.assets.find((asset) => asset.kind === 'load')!.id;
  source.assets.find((asset) => asset.kind === 'load')!.id = 'custom-load';
  source.dependencies = source.dependencies.map((edge) => ({
    ...edge,
    target: edge.target === oldLoad ? 'custom-load' : edge.target,
  }));
  source.battery_charge_kw = '0';
  const edited = scenarioWithDemand(source, {
    initialKw: '1000.000000001',
    steps: [step('300', '500'), step('900', '0', 'second')],
  });
  assert.deepEqual(
    edited.events.filter((event) => event.action !== 'set_demand'),
    source.events,
  );
  assert.deepEqual(edited.source_ids, source.source_ids);
  assert.equal(edited.it_demand_kw, '1000.000000001');
  assert.equal(edited.events.at(-1)!.target, 'custom-load');
  const result = assertNative(edited);
  // 100 kWh * .90 * .95 = 85.5 kWh available to IT; a 600 s x 500 kW outage needs 83 1/3 kWh.
  assert.equal(result.summary.unserved_it_kwh, '0');
  const draft = demandDraft(edited);
  draft.steps[0].atS = '900';
  draft.steps[0].demandKw = '600';
  const sameTime = scenarioWithDemand(edited, draft);
  assert.deepEqual(sameTime.events.slice(0, source.events.length), source.events);
  assertNative(sameTime);
});

test('invalid inputs and event overflow never mutate the source; boundary values remain valid', () => {
  const snapshot = JSON.stringify(base);
  for (const time of ['', '-1', '0.5', String(base.duration_s), 'Infinity', '1e3'])
    assert.throws(() =>
      scenarioWithDemand(base, { initialKw: '1000', steps: [step(time, '500')] }),
    );
  for (const power of ['', '-1', 'NaN', 'Infinity', '1e13', '1.0000000001'])
    assert.throws(() => scenarioWithDemand(base, { initialKw: '1000', steps: [step('1', power)] }));
  assert.throws(() => scenarioWithDemand(base, { initialKw: '', steps: [] }));
  assert.throws(
    () =>
      scenarioWithDemand(base, {
        initialKw: '1000',
        steps: Array.from({ length: 129 }, (_, index) => step(String(index), '500', String(index))),
      }),
    /128/,
  );
  assert.equal(JSON.stringify(base), snapshot);
  const zero = scenarioWithDemand(
    { ...base, duration_s: 1 },
    { initialKw: '0', steps: [step('0', '0')] },
  );
  assertNative(zero);
  const unicode = scenarioWithDemand(base, { initialKw: '١٠٠٠', steps: [step('1', '1e-9')] });
  assert.equal(unicode.it_demand_kw, '1000');
  assert.equal(unicode.events[0].value_kw, '0.000000001');
});

test('removing steps keeps all availability events and new steps bisect the largest gap', () => {
  const source = data.scenarios.ai_cluster_50mw_ramp as SiteScenario;
  assert.equal(scenarioWithDemand(source, { initialKw: '50000', steps: [] }).events.length, 0);
  assert.equal(nextStepTime(demandDraft(source), source.duration_s), 1350);
  assert.equal(nextStepTime({ initialKw: '1', steps: [] }, 1), 0);
});
