import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  facilityProfileById,
  facilityProfileByPresetId,
  facilityProfiles,
  scenarioModes,
} from '../src/facility-profiles';
import type { DemoData } from '../src/js-engine/types';

const root = resolve(process.cwd(), '../..');
const demoData = JSON.parse(
  readFileSync(resolve(root, '.local/browser-demo-assets/demo-data.json'), 'utf8'),
) as DemoData;

test('facility profiles resolve to generated demo scenarios with the stated load and reserve', () => {
  assert.deepEqual(
    facilityProfiles.map(({ id, loadMw }) => [id, loadMw]),
    [
      ['ai_cluster_50mw', 50],
      ['hyperscale_200mw', 200],
      ['crypto_30mw', 30],
      ['traditional_5mw', 5],
    ],
  );
  assert.deepEqual(
    scenarioModes.map(({ id, name }) => [id, name]),
    [
      ['outage', 'Grid outage'],
      ['ramp', 'Load step'],
      ['reserve', 'Extended reserve'],
    ],
  );
  for (const profile of facilityProfiles) {
    assert.equal(facilityProfileById.get(profile.id), profile);
    for (const mode of scenarioModes) {
      const preset = profile.presets[mode.id];
      assert.ok(demoData.presets.some((item) => item.id === preset));
      const scenario = demoData.scenarios[preset];
      assert.ok(scenario, `generated demo scenario is missing ${preset}`);
      assert.equal(facilityProfileByPresetId.get(preset), profile);
      assert.equal(Number(scenario.it_demand_kw), profile.loadMw * 1000);
      assert.equal(
        Number(scenario.it_capacity_kw),
        profile.loadMw * (mode.id === 'ramp' ? 1100 : 1000),
      );
      const reserveKwh = profile.loadMw * 1000 * (mode.id === 'reserve' ? 4 : 0.1);
      assert.equal(Number(scenario.battery_capacity_kwh), reserveKwh);
      assert.equal(Number(scenario.battery_initial_kwh), reserveKwh);
      assert.equal(Number(scenario.battery_charge_kw), mode.id === 'reserve' ? 0 : reserveKwh);
      assert.deepEqual(
        scenario.events.map(({ at_s }) => at_s),
        mode.id === 'outage'
          ? [300, 300, 900, 900]
          : mode.id === 'ramp'
            ? [300, 600, 900]
            : [300, 300, 11_100, 11_100],
      );
    }
  }
  assert.equal(
    facilityProfileByPresetId.get('ai_cluster_generator_failure')?.id,
    'ai_cluster_50mw',
  );
});
