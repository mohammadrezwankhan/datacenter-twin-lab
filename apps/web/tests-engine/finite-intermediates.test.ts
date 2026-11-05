import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateScreen } from '../src/infrastructure/screens.ts';

const thermal = {
  heatMW: 20,
  removedMW: 0,
  capacitanceMJK: 200,
  deltaK: 10,
  rackKW: 100,
  captureFraction: 0.8,
  waterDeltaK: 10,
  waterCp: 4186,
  airDensity: 1.2,
  airCp: 1005,
  airDeltaK: 12,
};
for (const [key, value, label] of [
  ['waterCp', 1e308, 'Water'],
  ['airCp', 1e308, 'Air'],
] as const) {
  void test(`thermal rejects an overflowing ${label.toLowerCase()} denominator`, () => {
    assert.throws(
      () => calculateScreen('thermalScreen', { ...thermal, [key]: value }),
      new RegExp(label + '.*overflow', 'i'),
    );
  });
}
void test('thermal rejects an underflowed positive heat-capacity product', () => {
  assert.throws(
    () =>
      calculateScreen('thermalScreen', {
        ...thermal,
        waterCp: 1e-300,
        waterDeltaK: 1e-300,
      }),
    /Water.*underflow/i,
  );
});
void test('ordinary thermal flow and lumped time remain correct', () => {
  const output = calculateScreen('thermalScreen', thermal);
  assert.equal(output.waterKgS, 80000 / 41860);
  assert.equal(output.residualAirM3S, 20000 / (1.2 * 1005 * 12));
  assert.equal(output.thermalLimitS, 100);
});
void test('zero captured heat still yields zero water flow with a valid denominator', () => {
  assert.equal(calculateScreen('thermalScreen', { ...thermal, captureFraction: 0 }).waterKgS, 0);
});
void test('equal extreme MTBF and MTTR retain half availability', () => {
  const output = calculateScreen('availability', {
    mtbfH: 1e308,
    mttrH: 1e308,
    sharedUnavailability: 0,
  });
  assert.equal(output.pathAvailability, 0.5);
  assert.equal(output.independentQ, 0.25);
  assert.equal(output.combinedQ, 0.25);
  assert.equal(output.unavailableMinutesPer8760H, 131400);
});
void test('availability remains correct for ordinary and zero repair time', () => {
  const ordinary = calculateScreen('availability', {
    mtbfH: 1000,
    mttrH: 10,
    sharedUnavailability: 0,
  });
  assert.ok(Math.abs((ordinary.pathAvailability as number) - 1000 / 1010) < 1e-15);
  assert.equal(
    calculateScreen('availability', {
      mtbfH: 1000,
      mttrH: 0,
      sharedUnavailability: 0,
    }).pathAvailability,
    1,
  );
});
void test('availability handles repair time greater than MTBF without an overflowing sum', () => {
  const output = calculateScreen('availability', {
    mtbfH: 1e308,
    mttrH: 1.5e308,
    sharedUnavailability: 0,
  });
  assert.ok(Math.abs((output.pathAvailability as number) - 0.4) < 1e-15);
});
