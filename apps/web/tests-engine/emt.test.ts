import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DEFAULT_EMT, EMT_PRESETS, simulateEmt, refineEmt, compareEmt } from '../src/emt/engine';
import { getEmtReferenceStatus, sourceStepPath } from '../src/emt/visuals';
import type { EmtResult } from '../src/emt/engine';
import { requiredPresent } from '../src/required-value';

void test('source-voltage chart path holds each level until its step event', () => {
  const result = simulateEmt(DEFAULT_EMT);

  assert.equal(
    sourceStepPath(
      result.rows,
      (time) => time,
      (voltage) => voltage,
    ),
    'M0.00 800.00 L40.00 800.00 L40.00 400.00 L120.00 400.00 L120.00 800.00 L200.00 800.00',
  );

  const flatResult = simulateEmt({ ...DEFAULT_EMT, sag_pu: 1 });
  assert.equal(
    sourceStepPath(
      flatResult.rows,
      (time) => time,
      (voltage) => voltage,
    ),
    'M0.00 800.00 L200.00 800.00',
  );
});

void test('source-voltage path handles empty and single-row input', () => {
  const x = (time: number) => time;
  const y = (voltage: number) => voltage;

  assert.equal(sourceStepPath([], x, y), '');
  assert.equal(sourceStepPath([{ time_ms: 0, source_v: 800 }], x, y), 'M0.00 800.00');
});

void test('scene reference status exposes bus overshoot and capacitor energy above initial', () => {
  const result = simulateEmt(DEFAULT_EMT);
  const peak = result.rows.reduce((maximum, row) => (row.bus_v > maximum.bus_v ? row : maximum));
  const status = getEmtReferenceStatus(DEFAULT_EMT, peak);

  assert.equal(status.bus.reference, 800);
  assert.equal(status.bus.exceeds, true);
  assert.ok(Math.abs(status.bus.value - 1014.1) < 0.2);
  assert.ok(status.bus.ratio > 1.26 && status.bus.ratio < 1.28);
  assert.equal(status.capacitor.exceeds, true);
  assert.ok(status.capacitor.ratio > 1.62 && status.capacitor.ratio < 1.64);
});

void test('EMT full outputs agree with native Python for presets, timestep and edge inputs', () => {
  const cases = [
    ...EMT_PRESETS.map((preset) => preset.config),
    { ...DEFAULT_EMT, sag_pu: 1, step_us: 5 },
    { ...DEFAULT_EMT, step_us: 50, capacitance_mf: 1, inductance_mh: 0.1, load_ohm: 2 },
    {
      ...DEFAULT_EMT,
      source_v: 1000,
      sag_pu: 0.1,
      sag_start_ms: 11,
      sag_duration_ms: 17,
      duration_ms: 300,
    },
  ];
  for (const config of cases) {
    const result = spawnSync(
      process.env.TWIN_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
      [
        '-c',
        'import sys,json;from datacenter_twin.browser import dispatch_json;print(dispatch_json("emt",sys.stdin.read()))',
      ],
      { cwd: '../..', input: JSON.stringify(config), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    );
    assert.equal(result.status, 0, result.stderr);
    // compareEmt checks every field, shape and finite numerical difference at runtime.
    const difference = compareEmt(simulateEmt(config), JSON.parse(result.stdout) as EmtResult);
    assert.ok(difference <= 1e-7, `complete output max difference ${String(difference)}`);
  }
});

void test('EMT no sag remains at the DC divider state and refinement converges', () => {
  const steady = simulateEmt({ ...DEFAULT_EMT, sag_pu: 1 });
  assert.ok(steady.rows.every((row) => Math.abs(row.bus_v - (800 * 12.8) / 12.88) < 1e-9));
  const comparison = refineEmt(DEFAULT_EMT);
  assert.ok(comparison.max_bus_difference_v < 1e-5);
  assert.ok(comparison.max_bus_difference_v > 0);
  assert.throws(() => simulateEmt({ ...DEFAULT_EMT, sag_pu: NaN }));
  assert.throws(() => simulateEmt({ ...DEFAULT_EMT, step_us: 1 }));
  assert.throws(() => simulateEmt({ ...DEFAULT_EMT, sag_start_ms: 40.5 }));
  const corrupt = structuredClone(steady);
  requiredPresent(corrupt.rows[900], 'EMT sample 900').bus_v += 0.01;
  assert.throws(() => compareEmt(steady, corrupt), /mismatch/);
});
