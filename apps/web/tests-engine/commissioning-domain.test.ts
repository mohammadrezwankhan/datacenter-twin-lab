import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateScreen } from '../src/infrastructure/screens.ts';

const inputs = {
  stageSeconds: [1, 10, 4],
  electricalSeconds: 60,
  thermalSeconds: 90,
  itMW: 20,
  hours: 8760,
  pue: 1.35,
  facilityRelativeUncertainty: 0.01,
  itRelativeUncertainty: 0.01,
};

for (const pue of [0.5, 0.999999]) {
  void test(`commissioning rejects PUE ${String(pue)} below the facility energy boundary`, () => {
    assert.throws(() => calculateScreen('commissioningScreen', { ...inputs, pue }), /pue/);
  });
}
for (const pue of [1, 1.35]) {
  void test(`commissioning accepts PUE ${String(pue)} and includes IT in facility energy`, () => {
    const output = calculateScreen('commissioningScreen', { ...inputs, pue });
    assert.equal(output.annualItMWh, 175200);
    assert.equal(output.annualFacilityMWh, 175200 * pue);
  });
}
