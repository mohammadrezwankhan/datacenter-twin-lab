import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requiredPresent } from '../src/required-value';
import {
  buildScreenResult,
  canonicalHash,
  calculateScreen,
  canonicalJson,
  type InfrastructureScreenResult,
  type LessonEvidence,
  type ModelName,
  type ReleaseGateInputs,
  type ScreenInputs,
} from '../src/infrastructure/screens';

type GoldenCase = {
  id: string;
  model: ModelName;
  inputs: ScreenInputs;
  expected: Record<string, number | string | boolean | null | string[]>;
};

const golden = JSON.parse(
  readFileSync(new URL('../../../data/infrastructure/golden-cases.json', import.meta.url), 'utf8'),
) as GoldenCase[];

for (const item of golden) {
  void test('golden ' + item.id, () => {
    const result = calculateScreen(item.model, item.inputs);
    for (const [key, expected] of Object.entries(item.expected)) {
      const actual = result[key];
      if (typeof expected === 'number') {
        assert.equal(typeof actual, 'number', key);
        assert.ok(
          Math.abs((actual as number) - expected) <= Math.max(1e-10, Math.abs(expected) * 1e-11),
          key + ': ' + String(actual) + ' != ' + String(expected),
        );
      } else assert.deepEqual(actual, expected, key);
    }
  });
}

const loadInputs: ScreenInputs = {
  racks: 2500,
  rackKW: 8,
  demandFactor: 1,
  growth: 0,
  designRatio: 1.35,
  coolingKW: 6200,
  pf: 0.9,
  voltageKV: 13.8,
};

const lesson: LessonEvidence = {
  id: 'evidence-load-ledger',
  contentVersion: '2.0.0',
  source: {
    id: 'DCIE-R1',
    chapter: 1,
    pdfPages: [10, 13],
    evidenceStatus: 'manuscript-derived; not independent source verification',
  },
  experiment: { model: 'loadLedger' },
  sections: [
    {
      title: 'Source values',
      body: 'Source-stated load values.',
      evidenceLabel: 'source-statement',
    },
    {
      title: 'Illustration',
      body: 'The design ratio is an assumption.',
      evidenceLabel: 'illustrative-assumption',
    },
  ],
  limits: ['No facility calibration.'],
};

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function verifiedResultHash(result: InfrastructureScreenResult): string {
  const entries: [string, unknown][] = Object.entries(result);
  const material = Object.fromEntries(entries.filter(([key]) => key !== 'resultHash'));
  return hash(canonicalJson(material));
}

void test('canonical JSON sorts object keys recursively and keeps array order', () => {
  assert.equal(
    canonicalJson({ z: [2, { y: true, a: null }], a: { d: 'x', b: 1 } }),
    '{"a":{"b":1,"d":"x"},"z":[2,{"a":null,"y":true}]}',
  );
  assert.throws(() => canonicalJson(Number.NaN));
  assert.throws(() => canonicalJson([, 1]));
});

void test('canonicalHash is SHA-256 of the documented canonical text', async () => {
  const value = { z: 2, a: [1, 3] };
  assert.equal(await canonicalHash(value), hash(canonicalJson(value)));
});

void test('inputs, type shape and finite domains are validated', () => {
  assert.throws(() => calculateScreen('not-a-model' as ModelName, {}));
  assert.throws(() => calculateScreen('loadLedger', null as unknown as ScreenInputs));
  assert.throws(() => calculateScreen('loadLedger', [] as unknown as ScreenInputs));
  assert.throws(() => calculateScreen('loadLedger', { ...loadInputs, pf: 0 }));
  assert.throws(() => calculateScreen('loadLedger', { ...loadInputs, pf: Number.NaN }));
  assert.throws(() =>
    calculateScreen('loadLedger', { ...loadInputs, pf: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() =>
    calculateScreen('loadLedger', { ...loadInputs, pf: '0.9' } as unknown as ScreenInputs),
  );
  assert.throws(() => calculateScreen('loadLedger', { ...loadInputs, ignored: 1 }));
  assert.throws(() =>
    calculateScreen('storageScreen', {
      acKW: 1,
      minutes: 1,
      efficiency: 1,
      dischargeFraction: 0,
      retainedAgeFraction: 1,
      minDcV: 1,
    }),
  );
  assert.throws(() =>
    calculateScreen('transformerScreen', {
      mva: 1,
      voltageV: 400,
      zPercent: 6,
      sourceMVA: 0,
    }),
  );
});

void test('integer counts, availability bounds and overflow are rejected', () => {
  const bank: ScreenInputs = {
    requiredMW: 9,
    unitMW: 2,
    derating: 0.9,
    loading: 0.9,
    installed: 7,
    unavailable: 1,
  };
  assert.throws(() => calculateScreen('capacityBank', { ...bank, installed: 7.5 }));
  assert.throws(() =>
    calculateScreen('capacityBank', { ...bank, installed: Number.MAX_SAFE_INTEGER + 1 }),
  );
  assert.throws(() => calculateScreen('capacityBank', { ...bank, unavailable: 8 }));
  assert.throws(() => calculateScreen('capacityBank', { ...bank, loading: 1.1 }));
  assert.throws(() => calculateScreen('loadLedger', { ...loadInputs, rackKW: 1e308 }));
  const stageSeconds: number[] = [];
  stageSeconds[1] = 1;
  assert.throws(() =>
    calculateScreen('commissioningScreen', {
      stageSeconds,
      electricalSeconds: 1,
      thermalSeconds: 1,
      itMW: 1,
      hours: 1,
      pue: 1,
      facilityRelativeUncertainty: 0,
      itRelativeUncertainty: 0,
    }),
  );
});

void test('source claims remain failed and battery AC energy stays distinct from nominal energy', () => {
  const bank = calculateScreen('capacityBank', {
    requiredMW: 27,
    unitMW: 2.4,
    derating: 1,
    loading: 1,
    installed: 10,
    unavailable: 1,
  });
  assert.ok((bank.availableMW as number) < 27);
  assert.equal(bank.availableMW, 21.599999999999998);
  assert.equal(bank.status, 'screen-failed');
  const battery = calculateScreen('storageScreen', {
    acKW: 2250,
    minutes: 10,
    efficiency: 0.95,
    dischargeFraction: 0.8,
    retainedAgeFraction: 0.8,
    minDcV: 420,
  });
  assert.equal(battery.acKWh, 375);
  assert.ok((battery.nominalKWh as number) > 616 && (battery.nominalKWh as number) < 617);
});

void test('inverse-time, disconnected network and no-rise edges stay explicit', () => {
  for (const multiple of [0, 1])
    assert.deepEqual(calculateScreen('inverseTime', { multiple, tms: 0.1 }), {
      tripS: null,
      status: 'outside-trip-domain',
    });
  assert.ok(
    (calculateScreen('inverseTime', { multiple: 1.000001, tms: 0.1 }).tripS as number) > 1e5,
  );
  const network = calculateScreen('networkScreen', {
    lengthM: 100,
    dbPerKm: 3.5,
    connectors: 4,
    connectorDB: 0.35,
    splices: 2,
    spliceDB: 0.1,
    engineeringMarginDB: 0.5,
    budgetDB: 2.45,
    downlinks: 48,
    downlinkGbps: 25,
    uplinks: 6,
    uplinkGbps: 100,
    lostUplinks: 6,
  });
  assert.equal(network.remainingMarginDB, 0);
  assert.equal(network.status, 'screen-satisfied');
  assert.equal(network.oversubscription, null);
  assert.equal(network.connectivity, 'disconnected');
  const thermal = calculateScreen('thermalScreen', {
    heatMW: 20,
    removedMW: 20,
    capacitanceMJK: 150,
    deltaK: 5,
    rackKW: 100,
    captureFraction: 0.8,
    waterDeltaK: 10,
    waterCp: 4180,
    airDensity: 1.2,
    airCp: 1005,
    airDeltaK: 12,
  });
  assert.equal(thermal.thermalLimitS, null);
  assert.equal(thermal.status, 'no-rise-in-lumped-model');
});

void test('all standalone screens fail closed when any release criterion is failed or unresolved', () => {
  const unresolved: ReleaseGateInputs = {
    capacity: 'pass',
    connectivity: 'pass',
    protection: 'unresolved',
    thermal: 'pass',
    controls: 'pass',
    evidence: 'pass',
  };
  assert.deepEqual(calculateScreen('releaseGate', unresolved), {
    status: 'hold',
    blocking: ['protection'],
    certification: false,
  });
  const allPass: ReleaseGateInputs = {
    capacity: 'pass',
    connectivity: 'pass',
    protection: 'pass',
    thermal: 'pass',
    controls: 'pass',
    evidence: 'pass',
  };
  assert.equal(calculateScreen('releaseGate', allPass).status, 'teaching-screens-satisfied');
  assert.equal(calculateScreen('releaseGate', allPass).certification, false);
  assert.throws(() => calculateScreen('releaseGate', {} as ReleaseGateInputs));
});

void test('supplementary fuel, conductor and availability equations are present', () => {
  assert.equal(
    calculateScreen('fuelScreen', { loadKW: 27000, hours: 48, litresPerKWh: 0.25 }).usableLitres,
    324000,
  );
  assert.ok(
    Math.abs(
      (calculateScreen('conductorScreen', { faultA: 20000, clearingS: 0.2, k: 143 })
        .minimumMM2 as number) - 62.54735601398013,
    ) < 1e-9,
  );
  const availability = calculateScreen('availability', {
    mtbfH: 100000,
    mttrH: 4,
    sharedUnavailability: 0.0001,
  });
  assert.ok(Math.abs((availability.unavailableMinutesPer8760H as number) - 52.5608409) < 1e-6);
});

void test('screen result hashes are canonical, tamper evident, and the completed input snapshot is immutable', async () => {
  const mutableInputs = { ...loadInputs };
  const pending = buildScreenResult(lesson, mutableInputs, 'revision-a');
  mutableInputs.racks = 1;
  const result = await pending;
  assert.equal(result.resultSchema, 'infrastructure-screen-1');
  assert.equal(result.modelVersion, '1.0.0');
  assert.equal(result.model, 'loadLedger');
  assert.equal(result.inputs.racks, 2500);
  assert.equal(result.outputs.facilityKW, 27000);
  assert.equal(result.inputUnits.racks, 'rack count');
  assert.equal(result.outputUnits.lineA, 'A');
  assert.deepEqual(result.assumptions, [
    'The design ratio is a source-specific assumed design point, not automatically annual PUE.',
    'Illustration: The design ratio is an assumption.',
  ]);
  assert.equal(result.limitations.at(-1), 'No facility calibration.');
  const sourceLocator = requiredPresent(result.sourceLocators[0], 'screen source locator');
  assert.deepEqual(sourceLocator.pdfPages, [10, 13]);
  assert.equal(result.sourceRevision, 'revision-a');
  assert.equal(result.independentEngineeringVerification, false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.inputs));
  assert.ok(Object.isFrozen(result.outputs));
  assert.ok(Object.isFrozen(result.assumptions));
  assert.ok(Object.isFrozen(sourceLocator.pdfPages));
  assert.equal(result.resultHash, verifiedResultHash(result));

  const reordered = await buildScreenResult(
    lesson,
    {
      voltageKV: 13.8,
      pf: 0.9,
      coolingKW: 6200,
      designRatio: 1.35,
      growth: 0,
      demandFactor: 1,
      rackKW: 8,
      racks: 2500,
    },
    'revision-a',
  );
  assert.equal(result.inputHash, reordered.inputHash);
  assert.equal(result.resultHash, reordered.resultHash);

  const tampered = {
    ...result,
    outputs: { ...result.outputs, facilityKW: 25000 },
  } as InfrastructureScreenResult;
  assert.notEqual(tampered.resultHash, verifiedResultHash(tampered));
});

void test('stage-array edits after Run cannot alter the completed time result', async () => {
  const timingLesson: LessonEvidence = {
    ...lesson,
    id: 'commissioning-evidence-loop',
    experiment: { model: 'commissioningScreen' },
    sections: [],
  };
  const stageSeconds = [2, 12, 3, 8];
  const inputs = {
    stageSeconds,
    electricalSeconds: 600,
    thermalSeconds: 37.5,
    itMW: 20,
    hours: 8760,
    pue: 1.35,
    facilityRelativeUncertainty: 0.01,
    itRelativeUncertainty: 0.01,
  };
  const pending = buildScreenResult(timingLesson, inputs, null);
  stageSeconds[3] = 99;
  const result = await pending;
  assert.deepEqual(result.inputs.stageSeconds, [2, 12, 3, 8]);
  assert.equal(result.outputs.restoreSeconds, 25);
  assert.ok(Object.isFrozen(result.inputs.stageSeconds));
  assert.throws(() => {
    (result.inputs.stageSeconds as number[])[0] = 99;
  });
});

void test('time and demand lessons retain the supplied 37.5 s and 25 s teaching values', () => {
  const thermal = calculateScreen('thermalScreen', {
    heatMW: 20,
    removedMW: 0,
    capacitanceMJK: 150,
    deltaK: 5,
    rackKW: 100,
    captureFraction: 0.8,
    waterDeltaK: 10,
    waterCp: 4180,
    airDensity: 1.2,
    airCp: 1005,
    airDeltaK: 12,
  });
  const commissioning = calculateScreen('commissioningScreen', {
    stageSeconds: [2, 12, 3, 8],
    electricalSeconds: 600,
    thermalSeconds: 37.5,
    itMW: 20,
    hours: 8760,
    pue: 1.35,
    facilityRelativeUncertainty: 0.01,
    itRelativeUncertainty: 0.01,
  });
  assert.equal(thermal.thermalLimitS, 37.5);
  assert.equal(commissioning.restoreSeconds, 25);
  assert.equal(commissioning.thermalMarginSeconds, 12.5);
});

void test('unit mappings describe every result value and preserve no legacy verification fields', async () => {
  const result = await buildScreenResult(lesson, loadInputs, null);
  assert.deepEqual(Object.keys(result.outputs).sort(), Object.keys(result.outputUnits).sort());
  assert.deepEqual(Object.keys(result.inputs).sort(), Object.keys(result.inputUnits).sort());
  assert.equal('verification' in result, false);
  assert.equal('certified' in result, false);
});
