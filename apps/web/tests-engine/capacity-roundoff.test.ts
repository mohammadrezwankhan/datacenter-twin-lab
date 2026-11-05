import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateScreen } from '../src/infrastructure/screens.ts';

function evaluate(model: 'capacityBank' | 'designReview', scale: number, demand = 2.1) {
  return model === 'capacityBank'
    ? calculateScreen(model, {
        requiredMW: demand * scale,
        unitMW: 0.7 * scale,
        derating: 1,
        loading: 1,
        installed: 4,
        unavailable: 1,
      })
    : calculateScreen(model, {
        demandMVA: demand * scale,
        unitMVA: 0.7 * scale,
        unitsPerSide: 4,
        unavailable: 1,
        voltageKV: 13.8,
        incomerA: 1e12,
      });
}

for (const model of ['capacityBank', 'designReview'] as const) {
  const status = model === 'capacityBank' ? 'status' : 'capacityStatus';
  const margin = model === 'capacityBank' ? 'marginMW' : 'marginMVA';
  for (const scale of [1e-9, 1, 1e9]) {
    void test(`${model} decimal equality at scale ${String(scale)} passes with one spare`, () => {
      const output = evaluate(model, scale);
      assert.equal(output[status], 'screen-satisfied');
      assert.equal(output[margin], 0);
      assert.equal(output.minimumNPlusOne, 4);
    });
    void test(`${model} meaningful deficit at scale ${String(scale)} still needs another unit`, () => {
      const output = evaluate(model, scale, 2.1 + 1e-10);
      assert.equal(output[status], 'screen-failed');
      assert.ok((output[margin] as number) < 0);
      assert.equal(output.minimumNPlusOne, 5);
    });
    void test(`${model} surplus at scale ${String(scale)} remains positive`, () => {
      const output = evaluate(model, scale, 2);
      assert.equal(output[status], 'screen-satisfied');
      assert.ok((output[margin] as number) > 0);
      assert.equal(output.minimumNPlusOne, 4);
    });
  }
}
void test('capacity rejects a required count outside the safe integer range', () => {
  assert.throws(
    () =>
      calculateScreen('capacityBank', {
        requiredMW: Number.MAX_SAFE_INTEGER,
        unitMW: 1,
        derating: 1,
        loading: 1,
        installed: 1,
        unavailable: 0,
      }),
    /safe integer/,
  );
});
void test('design review rejects an overflowing capacity ratio', () => {
  assert.throws(
    () =>
      calculateScreen('designReview', {
        demandMVA: 1e308,
        unitMVA: 1e-308,
        unitsPerSide: 1,
        unavailable: 0,
        voltageKV: 13.8,
        incomerA: 1,
      }),
    /overflow/i,
  );
});
