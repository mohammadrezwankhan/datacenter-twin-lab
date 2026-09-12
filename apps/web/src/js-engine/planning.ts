import { canonicalJson, sha256Hex } from './canonical';
import { decimalText, InputError, moneyText, Rational } from './decimal';
import type { JsonValue } from './types';
import { ENGINE_VERSION } from './version';

const LIMITATIONS = [
  'Demand estimate; supply continuity and delivered service are not simulated.',
  'PUE is an input assumption; cooling and losses must not be added again.',
  'Energy-only cost excludes demand charges, CAPEX, taxes and all other charges.',
  'Capacity screen does not establish electrical feasibility, resilience or certification.',
];

export interface PlanningSegment {
  label: string;
  hours: string;
  it_load_kw: string;
  assumed_pue: string;
}

export interface PlanningScenario {
  schema_version: 1;
  id: string;
  name: string;
  currency: 'USD' | 'EUR' | 'INR';
  it_capacity_kw: string;
  tariff_per_kwh: string | null;
  price_status: 'illustrative' | 'unknown';
  assumption_date: string;
  source_ids: string[];
  segments: PlanningSegment[];
}

export interface PlanningRun {
  schema_version: 1;
  engine_version: string;
  run_id: string;
  input_sha256: string;
  scenario_id: string;
  scenario_name: string;
  mode: 'SYNTHETIC_PLANNING';
  fidelity: 'coarse_assumed_pue';
  evidence_level: 'arithmetic_verified_only';
  source_ids: string[];
  assumptions: PlanningScenario;
  currency: PlanningScenario['currency'];
  boundary: string;
  duration_hours: string;
  it_energy_kwh: string;
  facility_energy_kwh: string;
  non_it_energy_kwh: string;
  period_pue: string | null;
  pue_undefined_reason: string | null;
  peak_it_demand_kw: string;
  it_capacity_margin_kw: string;
  capacity_screen: 'exceeds_envelope' | 'within_envelope';
  energy_only_cost: string | null;
  cost_unknown_reason: string | null;
  intervals: Record<string, JsonValue>[];
  limitations: string[];
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new InputError(`${name}: expected an object`);
  return value as Record<string, unknown>;
}

function exactKeys(data: Record<string, unknown>, keys: string[], name: string): void {
  const expected = new Set(keys);
  const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(data, key));
  const extra = Object.keys(data).filter((key) => !expected.has(key));
  if (missing.length || extra.length)
    throw new InputError(
      `${name}: missing fields [${missing.join(', ')}]; unknown fields [${extra.join(', ')}]`,
    );
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > 200)
    throw new InputError(`${name}: expected nonempty text of at most 200 characters`);
  return value;
}

function list(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100)
    throw new InputError(`${name}: expected 1 to 100 reference identifiers`);
  return value.map((item) => stringValue(item, name));
}

function dateValue(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new InputError('assumption_date: use a valid YYYY-MM-DD date');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new InputError('assumption_date: use a valid YYYY-MM-DD date');
  return value;
}

function segment(value: unknown): PlanningSegment {
  const data = object(value, 'segment');
  exactKeys(data, ['label', 'hours', 'it_load_kw', 'assumed_pue'], 'segment');
  const hours = Rational.fromDecimal(data.hours, 'hours', { positive: true });
  const load = Rational.fromDecimal(data.it_load_kw, 'it_load_kw');
  const pue = Rational.fromDecimal(data.assumed_pue, 'assumed_pue', { positive: true });
  if (pue.compare(Rational.one()) < 0)
    throw new InputError('assumed_pue: must be at least 1 in the coarse energy boundary');
  return {
    label: stringValue(data.label, 'label'),
    hours: decimalText(hours),
    it_load_kw: decimalText(load),
    assumed_pue: decimalText(pue),
  };
}

export function validatePlanningScenario(input: unknown): PlanningScenario {
  const data = object(input, 'scenario');
  exactKeys(
    data,
    [
      'schema_version',
      'id',
      'name',
      'currency',
      'it_capacity_kw',
      'tariff_per_kwh',
      'price_status',
      'assumption_date',
      'source_ids',
      'segments',
    ],
    'scenario',
  );
  if (data.schema_version !== 1 || typeof data.schema_version !== 'number')
    throw new InputError('schema_version: only integer 1 is supported');
  const currency = data.currency;
  if (currency !== 'USD' && currency !== 'EUR' && currency !== 'INR')
    throw new InputError('currency: use USD, EUR, or INR; automatic FX is not implemented');
  const priceStatus = data.price_status;
  if (priceStatus !== 'illustrative' && priceStatus !== 'unknown')
    throw new InputError('price_status: the preliminary contract supports illustrative or unknown');
  const tariff =
    data.tariff_per_kwh === null
      ? null
      : Rational.fromDecimal(data.tariff_per_kwh, 'tariff_per_kwh');
  if ((tariff === null) !== (priceStatus === 'unknown'))
    throw new InputError(
      'tariff_per_kwh: null must have unknown status; a value must be illustrative',
    );
  if (!Array.isArray(data.segments) || data.segments.length > 10000)
    throw new InputError('segments: expected a list with at most 10000 intervals');
  const result: PlanningScenario = {
    schema_version: 1,
    id: stringValue(data.id, 'id'),
    name: stringValue(data.name, 'name'),
    currency,
    it_capacity_kw: decimalText(
      Rational.fromDecimal(data.it_capacity_kw, 'it_capacity_kw', { positive: true }),
    ),
    tariff_per_kwh: tariff === null ? null : decimalText(tariff),
    price_status: priceStatus,
    assumption_date: dateValue(data.assumption_date),
    source_ids: list(data.source_ids, 'source_id'),
    segments: data.segments.map(segment),
  };
  return result;
}

export function simulatePlanning(input: unknown): PlanningRun {
  const scenario = validatePlanningScenario(input);
  const canonical = canonicalJson(scenario as never);
  const inputHash = sha256Hex(canonical);
  const runId = sha256Hex(`${ENGINE_VERSION}:${inputHash}`).slice(0, 20);
  let totalHours = Rational.zero();
  let itEnergy = Rational.zero();
  let facilityEnergy = Rational.zero();
  let peakIt = Rational.zero();
  const intervals: Record<string, JsonValue>[] = [];
  const capacity = Rational.fromDecimal(scenario.it_capacity_kw);
  for (const current of scenario.segments) {
    const hours = Rational.fromDecimal(current.hours);
    const load = Rational.fromDecimal(current.it_load_kw);
    const pue = Rational.fromDecimal(current.assumed_pue);
    const itKwh = load.mul(hours);
    const facilityKw = load.mul(pue);
    const facilityKwh = facilityKw.mul(hours);
    intervals.push({
      ...current,
      facility_demand_kw: decimalText(facilityKw),
      it_energy_kwh: decimalText(itKwh),
      facility_energy_kwh: decimalText(facilityKwh),
      exceeds_it_capacity: load.compare(capacity) > 0,
    });
    totalHours = totalHours.add(hours);
    itEnergy = itEnergy.add(itKwh);
    facilityEnergy = facilityEnergy.add(facilityKwh);
    if (load.compare(peakIt) > 0) peakIt = load;
  }
  const tariff =
    scenario.tariff_per_kwh === null ? null : Rational.fromDecimal(scenario.tariff_per_kwh);
  const cost = tariff === null ? null : moneyText(facilityEnergy.mul(tariff));
  return {
    schema_version: 1,
    engine_version: ENGINE_VERSION,
    run_id: runId,
    input_sha256: inputHash,
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    mode: 'SYNTHETIC_PLANNING',
    fidelity: 'coarse_assumed_pue',
    evidence_level: 'arithmetic_verified_only',
    source_ids: scenario.source_ids,
    assumptions: scenario,
    currency: scenario.currency,
    boundary: 'IT demand plus aggregate non-IT overhead; all facility energy assumed grid-imported',
    duration_hours: decimalText(totalHours),
    it_energy_kwh: decimalText(itEnergy),
    facility_energy_kwh: decimalText(facilityEnergy),
    non_it_energy_kwh: decimalText(facilityEnergy.sub(itEnergy)),
    period_pue: itEnergy.isZero() ? null : decimalText(facilityEnergy.div(itEnergy)),
    pue_undefined_reason: itEnergy.isZero() ? 'No IT energy in this period' : null,
    peak_it_demand_kw: decimalText(peakIt),
    it_capacity_margin_kw: decimalText(capacity.sub(peakIt)),
    capacity_screen: peakIt.compare(capacity) > 0 ? 'exceeds_envelope' : 'within_envelope',
    energy_only_cost: cost,
    cost_unknown_reason: cost === null ? 'Tariff is unknown' : null,
    intervals,
    limitations: LIMITATIONS,
  };
}
