import { requiredValue } from '../required-value';
export const MODEL_VERSION = '1.0.0';

export type ModelName =
  | 'loadLedger'
  | 'capacityBank'
  | 'availability'
  | 'transformerScreen'
  | 'fuelScreen'
  | 'storageScreen'
  | 'inverseTime'
  | 'conductorScreen'
  | 'auxiliaryScreen'
  | 'thermalScreen'
  | 'networkScreen'
  | 'facilityScreen'
  | 'commissioningScreen'
  | 'designReview'
  | 'releaseGate';

export type ScreenInputs = Readonly<Record<string, number | number[] | null>>;
export type ScreenOutputs = Readonly<Record<string, number | string | boolean | null | string[]>>;

export type LessonEvidence = {
  id: string;
  contentVersion: string;
  source: {
    id: string;
    chapter: number;
    pdfPages: number[];
    evidenceStatus: string;
  };
  experiment: { model: ModelName };
  sections: readonly { title: string; body: string; evidenceLabel: string }[];
  limits: readonly string[];
};

export type SourceLocator = {
  id: string;
  chapter: number;
  pdfPages: readonly [number, number];
  evidenceStatus: string;
};

export type InfrastructureScreenResult = {
  resultSchema: 'infrastructure-screen-1';
  contentVersion: string;
  modelVersion: string;
  lessonId: string;
  model: ModelName;
  inputs: ScreenInputs;
  outputs: ScreenOutputs;
  inputUnits: Readonly<Record<string, string>>;
  outputUnits: Readonly<Record<string, string>>;
  assumptions: readonly string[];
  limitations: readonly string[];
  sourceLocators: readonly SourceLocator[];
  inputHash: string;
  resultHash: string;
  sourceRevision: string | null;
  independentEngineeringVerification: false;
};

export type ReleaseGateState = 'pass' | 'fail' | 'unresolved';
export type ReleaseGateInputs = Readonly<{
  capacity: ReleaseGateState;
  connectivity: ReleaseGateState;
  protection: ReleaseGateState;
  thermal: ReleaseGateState;
  controls: ReleaseGateState;
  evidence: ReleaseGateState;
}>;

type InputRecord = Record<string, unknown>;
type OutputRecord = Record<string, number | string | boolean | null | string[]>;
type Runner = (p: InputRecord) => OutputRecord;

const num = (x: unknown, name: string, lo = 0, hi = Infinity): number => {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < lo || x > hi)
    throw new RangeError(
      name + ' must be a finite number in [' + String(lo) + ', ' + String(hi) + ']',
    );
  return x;
};
const pos = (x: unknown, name: string): number => {
  const value = num(x, name);
  if (value === 0) throw new RangeError(name + ' must exceed zero');
  return value;
};
const fraction = (x: unknown, name: string): number => {
  pos(x, name);
  return num(x, name, 0, 1);
};
const count = (x: unknown, name: string, lo = 0): number => {
  const value = num(x, name, lo);
  if (!Number.isSafeInteger(value)) throw new RangeError(name + ' must be a safe integer');
  return value;
};
const outcome = (margin: number): string => (margin >= 0 ? 'screen-satisfied' : 'screen-failed');

// Bound roundoff relative to the compared scale; never round physical units.
const scaledRoundoff = (...values: number[]): number =>
  8 * Number.EPSILON * Math.max(...values.map(Math.abs));
const capacityMargin = (available: number, required: number): number => {
  const margin = available - required;
  return Math.abs(margin) <= scaledRoundoff(available, required) ? 0 : margin;
};
const minimumWithSpare = (required: number, usableUnit: number): number => {
  const ratio = required / usableUnit;
  if (!Number.isFinite(ratio))
    throw new RangeError('Capacity ratio overflow: reduce the input range');
  const nearest = Math.round(ratio);
  const adjusted = Math.abs(ratio - nearest) <= scaledRoundoff(ratio, nearest) ? nearest : ratio;
  const result = Math.ceil(adjusted) + 1;
  if (!Number.isSafeInteger(result))
    throw new RangeError('Required unit count exceeds the safe integer range');
  return result;
};

const runners: Record<ModelName, Runner> = {
  loadLedger(p) {
    const racks = count(p.racks, 'racks');
    const rackKW = num(p.rackKW, 'rackKW');
    const demandFactor = num(p.demandFactor, 'demandFactor', 0, 1);
    const growth = num(p.growth, 'growth');
    const designRatio = num(p.designRatio, 'designRatio', 1);
    const coolingKW = num(p.coolingKW, 'coolingKW');
    const pf = fraction(p.pf, 'pf');
    const voltageKV = pos(p.voltageKV, 'voltageKV');
    const itKW = racks * rackKW * demandFactor * (1 + growth);
    const facilityKW = itKW * designRatio;
    const residualKW = facilityKW - itKW - coolingKW;
    return {
      itKW,
      facilityKW,
      residualKW,
      apparentKVA: facilityKW / pf,
      lineA: facilityKW / pf / (Math.sqrt(3) * voltageKV),
      status: outcome(residualKW),
    };
  },
  capacityBank(p) {
    const requiredMW = pos(p.requiredMW, 'requiredMW');
    const unitMW = pos(p.unitMW, 'unitMW');
    const derating = fraction(p.derating, 'derating');
    const loading = fraction(p.loading, 'loading');
    const installed = count(p.installed, 'installed', 1);
    const unavailable = count(p.unavailable, 'unavailable');
    if (unavailable > installed) throw new RangeError('unavailable exceeds installed');
    const usableUnitMW = unitMW * derating * loading;
    const availableMW = (installed - unavailable) * usableUnitMW;
    const marginMW = capacityMargin(availableMW, requiredMW);
    return {
      usableUnitMW,
      availableMW,
      marginMW,
      minimumNPlusOne: minimumWithSpare(requiredMW, usableUnitMW),
      status: outcome(marginMW),
    };
  },
  availability(p) {
    const mtbfH = pos(p.mtbfH, 'mtbfH');
    const mttrH = num(p.mttrH, 'mttrH');
    const sharedUnavailability = num(p.sharedUnavailability, 'sharedUnavailability', 0, 1);
    const q = mttrH <= mtbfH ? mttrH / mtbfH / (1 + mttrH / mtbfH) : 1 / (1 + mtbfH / mttrH);
    const independentQ = q * q;
    const combinedQ = sharedUnavailability + (1 - sharedUnavailability) * independentQ;
    return {
      pathAvailability: 1 - q,
      independentQ,
      combinedQ,
      unavailableMinutesPer8760H: combinedQ * 8760 * 60,
    };
  },
  transformerScreen(p) {
    const mva = pos(p.mva, 'mva');
    const voltageV = pos(p.voltageV, 'voltageV');
    const zPercent = pos(p.zPercent, 'zPercent');
    if (p.sourceMVA !== null) pos(p.sourceMVA, 'sourceMVA');
    const baseOhm = voltageV ** 2 / (mva * 1e6);
    const transformerOhm = (zPercent / 100) * baseOhm;
    const sourceOhm = p.sourceMVA === null ? 0 : voltageV ** 2 / ((p.sourceMVA as number) * 1e6);
    return {
      fullLoadA: (mva * 1e6) / (Math.sqrt(3) * voltageV),
      baseOhm,
      transformerOhm,
      sourceOhm,
      faultKA: voltageV / (Math.sqrt(3) * (transformerOhm + sourceOhm)) / 1000,
    };
  },
  fuelScreen(p) {
    const loadKW = num(p.loadKW, 'loadKW');
    const hours = num(p.hours, 'hours');
    const litresPerKWh = pos(p.litresPerKWh, 'litresPerKWh');
    return { usableLitres: loadKW * hours * litresPerKWh };
  },
  storageScreen(p) {
    const acKW = num(p.acKW, 'acKW');
    const minutes = num(p.minutes, 'minutes');
    const efficiency = fraction(p.efficiency, 'efficiency');
    const dischargeFraction = fraction(p.dischargeFraction, 'dischargeFraction');
    const retainedAgeFraction = fraction(p.retainedAgeFraction, 'retainedAgeFraction');
    const minDcV = pos(p.minDcV, 'minDcV');
    const acKWh = (acKW * minutes) / 60;
    const deliveredDcKWh = acKWh / efficiency;
    return {
      acKWh,
      deliveredDcKWh,
      nominalKWh: deliveredDcKWh / (dischargeFraction * retainedAgeFraction),
      dcA: (acKW * 1000) / (efficiency * minDcV),
    };
  },
  inverseTime(p) {
    const multiple = num(p.multiple, 'multiple');
    const tms = pos(p.tms, 'tms');
    if (multiple <= 1) return { tripS: null, status: 'outside-trip-domain' };
    return {
      tripS: (0.14 * tms) / Math.expm1(0.02 * Math.log(multiple)),
      status: 'model-evaluated',
    };
  },
  conductorScreen(p) {
    const faultA = num(p.faultA, 'faultA');
    const clearingS = num(p.clearingS, 'clearingS');
    const k = pos(p.k, 'k');
    return { minimumMM2: (faultA * Math.sqrt(clearingS)) / k };
  },
  auxiliaryScreen(p) {
    const harmonicA = num(p.harmonicA, 'harmonicA');
    const fundamentalA = pos(p.fundamentalA, 'fundamentalA');
    const referenceA = pos(p.referenceA, 'referenceA');
    const groundA = num(p.groundA, 'groundA');
    const groundOhm = num(p.groundOhm, 'groundOhm');
    const dcA = num(p.dcA, 'dcA');
    const oneWayM = num(p.oneWayM, 'oneWayM');
    const ohmPerM = num(p.ohmPerM, 'ohmPerM');
    return {
      thdPercent: (100 * harmonicA) / fundamentalA,
      tddPercent: (100 * harmonicA) / referenceA,
      groundPotentialRiseV: groundA * groundOhm,
      dcDropV: 2 * dcA * oneWayM * ohmPerM,
    };
  },
  thermalScreen(p) {
    const heatMW = num(p.heatMW, 'heatMW');
    const removedMW = num(p.removedMW, 'removedMW');
    const capacitanceMJK = pos(p.capacitanceMJK, 'capacitanceMJK');
    const deltaK = pos(p.deltaK, 'deltaK');
    const rackKW = num(p.rackKW, 'rackKW');
    const captureFraction = num(p.captureFraction, 'captureFraction', 0, 1);
    const waterDeltaK = pos(p.waterDeltaK, 'waterDeltaK');
    const waterCp = pos(p.waterCp, 'waterCp');
    const airDensity = pos(p.airDensity, 'airDensity');
    const airCp = pos(p.airCp, 'airCp');
    const airDeltaK = pos(p.airDeltaK, 'airDeltaK');
    const checkedPositiveProduct = (name: string, ...factors: number[]): number => {
      let product = 1;
      for (const factor of factors) {
        product *= factor;
        if (!Number.isFinite(product))
          throw new RangeError(name + ' overflow: reduce the input magnitudes');
        if (product === 0) throw new RangeError(name + ' underflow: increase the input magnitudes');
      }
      return product;
    };
    const waterDenominator = checkedPositiveProduct(
      'Water heat-capacity product',
      waterCp,
      waterDeltaK,
    );
    const airDenominator = checkedPositiveProduct(
      'Air heat-capacity product',
      airDensity,
      airCp,
      airDeltaK,
    );
    const netMW = heatMW - removedMW;
    const liquidKW = rackKW * captureFraction;
    const residualAirKW = rackKW - liquidKW;
    return {
      liquidKW,
      residualAirKW,
      waterKgS: (liquidKW * 1000) / waterDenominator,
      residualAirM3S: (residualAirKW * 1000) / airDenominator,
      temperatureRiseKS: netMW / capacitanceMJK,
      thermalLimitS: netMW > 0 ? (capacitanceMJK * deltaK) / netMW : null,
      status: netMW > 0 ? 'finite-lumped-limit' : 'no-rise-in-lumped-model',
    };
  },
  networkScreen(p) {
    const lengthM = num(p.lengthM, 'lengthM');
    const dbPerKm = num(p.dbPerKm, 'dbPerKm');
    const connectors = count(p.connectors, 'connectors');
    const connectorDB = num(p.connectorDB, 'connectorDB');
    const splices = count(p.splices, 'splices');
    const spliceDB = num(p.spliceDB, 'spliceDB');
    const engineeringMarginDB = num(p.engineeringMarginDB, 'engineeringMarginDB');
    const budgetDB = num(p.budgetDB, 'budgetDB');
    const downlinks = count(p.downlinks, 'downlinks');
    const downlinkGbps = pos(p.downlinkGbps, 'downlinkGbps');
    const uplinks = count(p.uplinks, 'uplinks');
    const uplinkGbps = pos(p.uplinkGbps, 'uplinkGbps');
    const lostUplinks = count(p.lostUplinks, 'lostUplinks');
    if (lostUplinks > uplinks) throw new RangeError('lostUplinks exceeds uplinks');
    const physicalLossDB =
      (lengthM / 1000) * dbPerKm + connectors * connectorDB + splices * spliceDB;
    const budgetUseDB = physicalLossDB + engineeringMarginDB;
    const activeUplinkGbps = (uplinks - lostUplinks) * uplinkGbps;
    return {
      physicalLossDB,
      budgetUseDB,
      remainingMarginDB: budgetDB - budgetUseDB,
      activeUplinkGbps,
      oversubscription: activeUplinkGbps > 0 ? (downlinks * downlinkGbps) / activeUplinkGbps : null,
      connectivity: activeUplinkGbps > 0 ? 'connected' : 'disconnected',
      status: outcome(budgetDB - budgetUseDB),
    };
  },
  facilityScreen(p) {
    const massKG = num(p.massKG, 'massKG');
    const areaM2 = pos(p.areaM2, 'areaM2');
    const gravityMS2 = pos(p.gravityMS2, 'gravityMS2');
    const coolingUnits = count(p.coolingUnits, 'coolingUnits');
    const tonsPerUnit = num(p.tonsPerUnit, 'tonsPerUnit');
    const kwPerTon = pos(p.kwPerTon, 'kwPerTon');
    return {
      averageKPa: (massKG * gravityMS2) / areaM2 / 1000,
      installedThermalKW: coolingUnits * tonsPerUnit * kwPerTon,
    };
  },
  commissioningScreen(p) {
    if (!Array.isArray(p.stageSeconds) || p.stageSeconds.length === 0)
      throw new RangeError('stageSeconds is empty');
    const stageSeconds = p.stageSeconds.map((value: unknown, i: number) =>
      num(value, 'stage ' + String(i)),
    );
    const electricalSeconds = num(p.electricalSeconds, 'electricalSeconds');
    const thermalSeconds = num(p.thermalSeconds, 'thermalSeconds');
    const itMW = num(p.itMW, 'itMW');
    const hours = num(p.hours, 'hours');
    const pue = num(p.pue, 'pue', 1);
    const facilityRelativeUncertainty = num(
      p.facilityRelativeUncertainty,
      'facilityRelativeUncertainty',
    );
    const itRelativeUncertainty = num(p.itRelativeUncertainty, 'itRelativeUncertainty');
    const restoreSeconds = stageSeconds.reduce((a, b) => a + b, 0);
    const annualItMWh = itMW * hours;
    return {
      restoreSeconds,
      thermalMarginSeconds: thermalSeconds - restoreSeconds,
      electricalMarginSeconds: electricalSeconds - restoreSeconds,
      annualItMWh,
      annualFacilityMWh: annualItMWh * pue,
      pueStandardUncertainty: pue * Math.hypot(facilityRelativeUncertainty, itRelativeUncertainty),
    };
  },
  designReview(p) {
    const demandMVA = pos(p.demandMVA, 'demandMVA');
    const unitMVA = pos(p.unitMVA, 'unitMVA');
    const unitsPerSide = count(p.unitsPerSide, 'unitsPerSide', 1);
    const unavailable = count(p.unavailable, 'unavailable');
    const voltageKV = pos(p.voltageKV, 'voltageKV');
    const incomerA = pos(p.incomerA, 'incomerA');
    if (unavailable > unitsPerSide) throw new RangeError('unavailable exceeds unitsPerSide');
    const availableMVA = (unitsPerSide - unavailable) * unitMVA;
    const fullLoadA = (unitMVA * 1000) / (Math.sqrt(3) * voltageKV);
    const marginMVA = capacityMargin(availableMVA, demandMVA);
    return {
      availableMVA,
      marginMVA,
      minimumNPlusOne: minimumWithSpare(demandMVA, unitMVA),
      fullLoadA,
      incomerMarginA: incomerA - fullLoadA,
      capacityStatus: outcome(marginMVA),
      currentStatus: outcome(incomerA - fullLoadA),
    };
  },
  releaseGate(p) {
    return runReleaseGate(p as ReleaseGateInputs);
  },
};

const requiredGateStates: readonly (keyof ReleaseGateInputs)[] = [
  'capacity',
  'connectivity',
  'protection',
  'thermal',
  'controls',
  'evidence',
];

function runReleaseGate(states: ReleaseGateInputs): OutputRecord {
  const blocking: string[] = [];
  for (const key of requiredGateStates) {
    const state = states[key];
    if (state !== 'pass' && state !== 'fail' && state !== 'unresolved')
      throw new RangeError('Missing or invalid ' + key + ' state');
    if (state !== 'pass') blocking.push(key);
  }
  return {
    status: blocking.length ? 'hold' : 'teaching-screens-satisfied',
    blocking,
    certification: false,
  };
}

const inputUnits: Record<ModelName, Readonly<Record<string, string>>> = {
  loadLedger: {
    racks: 'rack count',
    rackKW: 'kW/rack',
    demandFactor: 'ratio',
    growth: 'ratio',
    designRatio: 'ratio',
    coolingKW: 'kW',
    pf: 'power factor',
    voltageKV: 'kV',
  },
  capacityBank: {
    requiredMW: 'MW',
    unitMW: 'MW/unit',
    derating: 'ratio',
    loading: 'ratio',
    installed: 'units',
    unavailable: 'units',
  },
  availability: { mtbfH: 'h', mttrH: 'h', sharedUnavailability: 'ratio' },
  transformerScreen: {
    mva: 'MVA',
    voltageV: 'V line-to-line',
    zPercent: '%',
    sourceMVA: 'MVA or null',
  },
  fuelScreen: { loadKW: 'kW', hours: 'h', litresPerKWh: 'L/kWh' },
  storageScreen: {
    acKW: 'kW AC',
    minutes: 'min',
    efficiency: 'ratio',
    dischargeFraction: 'ratio',
    retainedAgeFraction: 'ratio',
    minDcV: 'V DC',
  },
  inverseTime: { multiple: 'multiple of pickup', tms: 'time multiplier setting' },
  conductorScreen: { faultA: 'A', clearingS: 's', k: 'A·√s/mm²' },
  auxiliaryScreen: {
    harmonicA: 'A RMS',
    fundamentalA: 'A RMS',
    referenceA: 'A RMS',
    groundA: 'A',
    groundOhm: 'Ω',
    dcA: 'A DC',
    oneWayM: 'm',
    ohmPerM: 'Ω/m',
  },
  thermalScreen: {
    heatMW: 'MW',
    removedMW: 'MW',
    capacitanceMJK: 'MJ/K',
    deltaK: 'K',
    rackKW: 'kW',
    captureFraction: 'ratio',
    waterDeltaK: 'K',
    waterCp: 'J/(kg·K)',
    airDensity: 'kg/m³',
    airCp: 'J/(kg·K)',
    airDeltaK: 'K',
  },
  networkScreen: {
    lengthM: 'm',
    dbPerKm: 'dB/km',
    connectors: 'count',
    connectorDB: 'dB/connector',
    splices: 'count',
    spliceDB: 'dB/splice',
    engineeringMarginDB: 'dB',
    budgetDB: 'dB',
    downlinks: 'count',
    downlinkGbps: 'Gb/s',
    uplinks: 'count',
    uplinkGbps: 'Gb/s',
    lostUplinks: 'count',
  },
  facilityScreen: {
    massKG: 'kg',
    areaM2: 'm²',
    gravityMS2: 'm/s²',
    coolingUnits: 'units',
    tonsPerUnit: 'refrigeration tons/unit',
    kwPerTon: 'kW/ton',
  },
  commissioningScreen: {
    stageSeconds: 's per stage',
    electricalSeconds: 's',
    thermalSeconds: 's',
    itMW: 'MW',
    hours: 'h',
    pue: 'ratio',
    facilityRelativeUncertainty: 'ratio',
    itRelativeUncertainty: 'ratio',
  },
  designReview: {
    demandMVA: 'MVA',
    unitMVA: 'MVA/unit',
    unitsPerSide: 'units/side',
    unavailable: 'units',
    voltageKV: 'kV line-to-line',
    incomerA: 'A',
  },
  releaseGate: {
    capacity: 'state',
    connectivity: 'state',
    protection: 'state',
    thermal: 'state',
    controls: 'state',
    evidence: 'state',
  },
};

const outputUnits: Record<ModelName, Readonly<Record<string, string>>> = {
  loadLedger: {
    itKW: 'kW',
    facilityKW: 'kW',
    residualKW: 'kW',
    apparentKVA: 'kVA',
    lineA: 'A',
    status: 'screen state',
  },
  capacityBank: {
    usableUnitMW: 'MW/unit',
    availableMW: 'MW',
    marginMW: 'MW',
    minimumNPlusOne: 'units',
    status: 'screen state',
  },
  availability: {
    pathAvailability: 'ratio',
    independentQ: 'ratio',
    combinedQ: 'ratio',
    unavailableMinutesPer8760H: 'min per 8,760 h',
  },
  transformerScreen: {
    fullLoadA: 'A',
    baseOhm: 'Ω',
    transformerOhm: 'Ω',
    sourceOhm: 'Ω',
    faultKA: 'kA',
  },
  fuelScreen: { usableLitres: 'L' },
  storageScreen: {
    acKWh: 'kWh AC',
    deliveredDcKWh: 'kWh DC',
    nominalKWh: 'kWh nominal',
    dcA: 'A DC',
  },
  inverseTime: { tripS: 's or null outside trip domain', status: 'curve state' },
  conductorScreen: { minimumMM2: 'mm²' },
  auxiliaryScreen: {
    thdPercent: '%',
    tddPercent: '%',
    groundPotentialRiseV: 'V',
    dcDropV: 'V DC',
  },
  thermalScreen: {
    liquidKW: 'kW',
    residualAirKW: 'kW',
    waterKgS: 'kg/s',
    residualAirM3S: 'm³/s',
    temperatureRiseKS: 'K/s',
    thermalLimitS: 's or null for no positive net rise',
    status: 'thermal state',
  },
  networkScreen: {
    physicalLossDB: 'dB',
    budgetUseDB: 'dB',
    remainingMarginDB: 'dB',
    activeUplinkGbps: 'Gb/s',
    oversubscription: 'ratio or null when disconnected',
    connectivity: 'connectivity state',
    status: 'screen state',
  },
  facilityScreen: { averageKPa: 'kPa', installedThermalKW: 'kW' },
  commissioningScreen: {
    restoreSeconds: 's',
    thermalMarginSeconds: 's',
    electricalMarginSeconds: 's',
    annualItMWh: 'MWh/year',
    annualFacilityMWh: 'MWh/year',
    pueStandardUncertainty: 'ratio',
  },
  designReview: {
    availableMVA: 'MVA',
    marginMVA: 'MVA',
    minimumNPlusOne: 'units',
    fullLoadA: 'A',
    incomerMarginA: 'A',
    capacityStatus: 'screen state',
    currentStatus: 'screen state',
  },
  releaseGate: { status: 'release state', blocking: 'criterion names', certification: 'boolean' },
};

const modelAssumptions: Record<ModelName, readonly string[]> = {
  loadLedger: [
    'The design ratio is a source-specific assumed design point, not automatically annual PUE.',
  ],
  capacityBank: ['Unit capacity is multiplied by the stated derating and loading factors.'],
  availability: [
    'Two components are treated as independent except for the stated shared unavailability.',
  ],
  transformerScreen: [
    'The fault screen uses a simplified series impedance equivalent and balanced three-phase current.',
  ],
  fuelScreen: ['Fuel use is constant at the supplied load and source coefficient.'],
  storageScreen: [
    'The constant-power screen applies scalar conversion, usable-discharge and retained-age fractions.',
  ],
  inverseTime: [
    'The supplied IEC-style inverse-time equation is a curve illustration, not a relay setting.',
  ],
  conductorScreen: [
    'The adiabatic conductor relation is a screening equation using the supplied k factor.',
  ],
  auxiliaryScreen: [
    'Harmonic ratios, ground rise and DC cable drop use the supplied scalar boundaries.',
  ],
  thermalScreen: [
    'Thermal capacitance and net heat are treated as a spatially lumped constant-rate screen.',
  ],
  networkScreen: [
    'Optical losses add linearly; traffic capacity is a nominal arithmetic allocation.',
  ],
  facilityScreen: [
    'Area pressure is uniformly averaged and cooling conversion uses the supplied coefficient.',
  ],
  commissioningScreen: [
    'Stage times are added sequentially; uncertainty inputs are treated as independent.',
  ],
  designReview: [
    'Each side is evaluated independently after the stated unavailable units are removed.',
  ],
  releaseGate: [
    'Every required criterion must explicitly pass; the software never awards certification.',
  ],
};

const modelLimitations: readonly string[] = [
  'Educational screen only; no equipment selection, facility calibration, professional review or certification.',
  'No dynamics, protection coordination, site conditions or manufacturer-specific behavior are inferred.',
];

export function screenUnits(model: ModelName): {
  inputs: Readonly<Record<string, string>>;
  outputs: Readonly<Record<string, string>>;
} {
  if (!Object.hasOwn(inputUnits, model)) throw new RangeError('Unknown model: ' + model);
  return freezeTree({ inputs: inputUnits[model], outputs: outputUnits[model] });
}

function cloneInputRecord(input: unknown, model: ModelName): InputRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('Inputs must be an object');
  if (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
    throw new TypeError('Inputs must be a plain object');
  if (Reflect.ownKeys(input).some((key) => typeof key !== 'string'))
    throw new TypeError('Inputs must contain string keys only');
  const cloned: InputRecord = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(inputUnits[model], key)) throw new RangeError('Unknown input: ' + key);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new RangeError(key + ' must be finite');
      cloned[key] = value;
    } else if (value === null) cloned[key] = null;
    else if (Array.isArray(value) && key === 'stageSeconds') {
      cloned[key] = Array.from({ length: value.length }, (_, index) => {
        if (!Object.hasOwn(value, index)) throw new TypeError('stageSeconds must not be sparse');
        return num(value[index], key + '[' + String(index) + ']');
      });
    } else {
      throw new TypeError(key + ' must be a number, number array, or null');
    }
  }
  return cloned;
}

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

function assertFiniteTree(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new RangeError('Result overflow: reduce the input range');
  if (value && typeof value === 'object') Object.values(value).forEach(assertFiniteTree);
}

export function calculateScreen(model: ModelName, inputs: ScreenInputs): ScreenOutputs;
export function calculateScreen(model: 'releaseGate', inputs: ReleaseGateInputs): ScreenOutputs;
export function calculateScreen(
  model: ModelName,
  inputs: ScreenInputs | ReleaseGateInputs,
): ScreenOutputs {
  if (!Object.hasOwn(runners, model)) throw new RangeError('Unknown model: ' + model);
  if (model === 'releaseGate') {
    if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs))
      throw new TypeError('Inputs must be an object');
    if (
      Object.getPrototypeOf(inputs) !== Object.prototype &&
      Object.getPrototypeOf(inputs) !== null
    )
      throw new TypeError('Inputs must be a plain object');
    if (Reflect.ownKeys(inputs).some((key) => typeof key !== 'string'))
      throw new TypeError('Inputs must contain string keys only');
    if (Object.keys(inputs).some((key) => !Object.hasOwn(inputUnits.releaseGate, key)))
      throw new RangeError('Unknown release criterion');
    const result = runners.releaseGate(inputs as InputRecord);
    assertFiniteTree(result);
    return freezeTree(result);
  }
  const cloned = cloneInputRecord(inputs, model);
  const result = runners[model](cloned);
  assertFiniteTree(result);
  return freezeTree(result);
}

function unitMap(model: ModelName, supplied: InputRecord): Record<string, string> {
  const known = inputUnits[model];
  return Object.fromEntries(
    Object.keys(supplied).map((key) => [key, known[key] ?? 'unitless']),
  ) as Record<string, string>;
}

function outputUnitMap(model: ModelName, output: OutputRecord): Record<string, string> {
  const known = outputUnits[model];
  return Object.fromEntries(
    Object.keys(output).map((key) => [key, known[key] ?? 'unitless']),
  ) as Record<string, string>;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON requires finite numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index))
        throw new TypeError('Canonical JSON does not allow sparse arrays');
      parts.push(canonicalJson(value[index]));
    }
    return '[' + parts.join(',') + ']';
  }
  if (typeof value === 'object' && value !== null) {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new TypeError('Canonical JSON requires plain objects');
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string'))
      throw new TypeError('Canonical JSON requires string keys');
    const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return (
      '{' +
      keys
        .map(
          (key) =>
            JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key]),
        )
        .join(',') +
      '}'
    );
  }
  throw new TypeError('Canonical JSON accepts only JSON values');
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function canonicalHash(value: unknown): Promise<string> {
  return sha256(canonicalJson(value));
}

function sourceLocator(lesson: LessonEvidence): SourceLocator {
  const pages = lesson.source.pdfPages;
  if (!pages.length || pages.some((page) => !Number.isInteger(page) || page <= 0))
    throw new RangeError('Source PDF pages must be positive integers');
  return {
    id: lesson.source.id,
    chapter: lesson.source.chapter,
    pdfPages: [
      requiredValue(pages[0], 'pages[0]'),
      requiredValue(pages[pages.length - 1], 'pages[pages.length - 1]'),
    ],
    evidenceStatus: lesson.source.evidenceStatus,
  };
}

export async function buildScreenResult(
  lesson: LessonEvidence,
  inputs: ScreenInputs,
  sourceRevision: string | null,
): Promise<InfrastructureScreenResult> {
  const applied = cloneInputRecord(inputs, lesson.experiment.model);
  const outputs = calculateScreen(lesson.experiment.model, applied as ScreenInputs);
  const locator = sourceLocator(lesson);
  const assumptions = [
    ...modelAssumptions[lesson.experiment.model],
    ...lesson.sections
      .filter((section) => section.evidenceLabel === 'illustrative-assumption')
      .map((section) => section.title + ': ' + section.body),
  ];
  const resultWithoutHash = {
    resultSchema: 'infrastructure-screen-1' as const,
    contentVersion: lesson.contentVersion,
    modelVersion: MODEL_VERSION,
    lessonId: lesson.id,
    model: lesson.experiment.model,
    inputs: freezeTree(applied) as ScreenInputs,
    outputs,
    inputUnits: freezeTree(unitMap(lesson.experiment.model, applied)),
    outputUnits: freezeTree(outputUnitMap(lesson.experiment.model, outputs as OutputRecord)),
    assumptions: freezeTree(assumptions),
    limitations: freezeTree([...modelLimitations, ...lesson.limits]),
    sourceLocators: freezeTree([locator]),
    inputHash: await sha256(
      canonicalJson({
        resultSchema: 'infrastructure-screen-1',
        contentVersion: lesson.contentVersion,
        modelVersion: MODEL_VERSION,
        lessonId: lesson.id,
        model: lesson.experiment.model,
        inputs: applied,
      }),
    ),
    sourceRevision,
    independentEngineeringVerification: false as const,
  };
  const resultHash = await sha256(canonicalJson(resultWithoutHash));
  return freezeTree({ ...resultWithoutHash, resultHash });
}
