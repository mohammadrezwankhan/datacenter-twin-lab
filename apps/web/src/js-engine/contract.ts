import { compareUnicode } from './canonical';
import { decimalText, InputError, Rational } from './decimal';
import type { Asset, Dependency, ScenarioEvent, SiteScenario } from './types';

type RecordValue = { [key: string]: unknown };

function object(value: unknown, name: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new InputError(`${name}: expected an object`);
  return value as RecordValue;
}

function exactKeys(value: RecordValue, required: string[], name: string): void {
  const expected = new Set(required);
  const actual = Object.keys(value);
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const extra = actual.filter((key) => !expected.has(key));
  if (missing.length || extra.length)
    throw new InputError(
      `${name}: missing fields [${missing.join(', ')}]; unknown fields [${extra.join(', ')}]`,
    );
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > 200)
    throw new InputError(`${name}: expected nonempty text of at most 200 characters`);
  return value;
}

function decimal(value: unknown, name: string, positive = false): Rational {
  return Rational.fromDecimal(value, name, { positive });
}

function integer(value: unknown, name: string, low: number, high: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < low || value > high)
    throw new InputError(`${name}: expected an integer from ${low} to ${high}`);
  return value;
}

function stringList(value: unknown, name: string, nonempty = true): string[] {
  if (!Array.isArray(value) || value.length > 100 || (nonempty && value.length === 0))
    throw new InputError(`${name}: expected ${nonempty ? '1' : '0'} to 100 identifiers`);
  const result = value.map((item) => text(item, name));
  if (new Set(result).size !== result.length)
    throw new InputError(`${name}: duplicate identifiers`);
  return result;
}

function asset(value: unknown): Asset {
  const data = object(value, 'asset');
  exactKeys(data, ['id', 'name', 'kind', 'capacity_kw', 'failure_domains', 'source_ids'], 'asset');
  const kind = data.kind;
  if (!['utility', 'generator', 'battery', 'bus', 'distribution', 'load'].includes(String(kind)))
    throw new InputError('asset.kind: unsupported asset type');
  return {
    id: text(data.id, 'asset.id'),
    name: text(data.name, 'asset.name'),
    kind: kind as string,
    capacity_kw: decimalText(decimal(data.capacity_kw, 'capacity_kw', true)),
    failure_domains: stringList(data.failure_domains, 'failure_domains'),
    source_ids: stringList(data.source_ids, 'source_ids'),
  };
}

function dependency(value: unknown): Dependency {
  const data = object(value, 'dependency');
  exactKeys(data, ['source', 'target', 'relation'], 'dependency');
  const source = text(data.source, 'dependency.source');
  const target = text(data.target, 'dependency.target');
  const relation = data.relation;
  if (source === target || !['feeds', 'requires', 'charges'].includes(String(relation)))
    throw new InputError(
      'dependency: distinct endpoints and feeds/requires/charges relation required',
    );
  return { source, target, relation: relation as string };
}

function event(value: unknown): ScenarioEvent {
  const data = object(value, 'event');
  exactKeys(data, ['at_s', 'action', 'target', 'value_kw'], 'event');
  const at_s = integer(data.at_s, 'event.at_s', 0, 86400);
  const action = data.action;
  if (
    typeof action !== 'string' ||
    !['asset_down', 'asset_up', 'domain_down', 'domain_up', 'set_demand'].includes(action)
  )
    throw new InputError('event.action: unsupported simulated event');
  const target = text(data.target, 'event.target');
  if (action === 'set_demand')
    return {
      at_s,
      action,
      target,
      value_kw: decimalText(decimal(data.value_kw, 'event.value_kw')),
    };
  if (data.value_kw !== null)
    throw new InputError('event.value_kw: must be null for availability events');
  return { at_s, action, target, value_kw: null };
}

function topo(scenarioAssets: Asset[], dependencies: Dependency[], relation: string): string[] {
  const ids = new Set(scenarioAssets.map((item) => item.id));
  const incoming = new Map<string, number>(Array.from(ids, (id) => [id, 0]));
  const outgoing = new Map<string, string[]>(Array.from(ids, (id) => [id, []]));
  for (const edge of dependencies) {
    if (edge.relation !== relation) continue;
    incoming.set(edge.target, incoming.get(edge.target)! + 1);
    outgoing.get(edge.source)!.push(edge.target);
  }
  const queue = Array.from(ids)
    .filter((id) => incoming.get(id) === 0)
    .sort(compareUnicode);
  const result: string[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    result.push(current);
    for (const target of outgoing.get(current)!.slice().sort(compareUnicode)) {
      const count = incoming.get(target)! - 1;
      incoming.set(target, count);
      if (count === 0) {
        queue.push(target);
        queue.sort(compareUnicode);
      }
    }
  }
  if (result.length !== ids.size) throw new InputError(`Topology contains a ${relation} cycle`);
  return result;
}

const scenarioFields = [
  'schema_version',
  'id',
  'name',
  'currency',
  'duration_s',
  'step_s',
  'it_demand_kw',
  'it_capacity_kw',
  'distribution_efficiency',
  'tariff_per_kwh',
  'generator_cost_per_kwh',
  'generator_start_delay_s',
  'battery_capacity_kwh',
  'battery_initial_kwh',
  'battery_charge_kw',
  'battery_charge_efficiency',
  'battery_discharge_efficiency',
  'source_ids',
  'assets',
  'dependencies',
  'events',
];

/** Validate and canonicalize a schema-2 scenario for simulation. */
export function validateScenario(input: unknown): SiteScenario {
  const data = object(input, 'continuity scenario');
  exactKeys(data, scenarioFields, 'continuity scenario');
  if (data.schema_version !== 2 || typeof data.schema_version !== 'number')
    throw new InputError('schema_version: only integer 2 is supported');
  const currency = data.currency;
  if (currency !== 'USD' && currency !== 'EUR' && currency !== 'INR')
    throw new InputError('currency: expected USD, EUR or INR; no FX conversion');
  const duration_s = integer(data.duration_s, 'duration_s', 1, 86400);
  const step_s = integer(data.step_s, 'step_s', 1, 3600);
  if (duration_s > step_s * 2000)
    throw new InputError('Requested time resolution exceeds 2000 regular intervals');
  const generator_start_delay_s = integer(
    data.generator_start_delay_s,
    'generator_start_delay_s',
    0,
    86400,
  );
  const it_demand = decimal(data.it_demand_kw, 'it_demand_kw');
  const it_capacity = decimal(data.it_capacity_kw, 'it_capacity_kw', true);
  const distribution = decimal(data.distribution_efficiency, 'distribution_efficiency', true);
  const chargeEfficiency = decimal(
    data.battery_charge_efficiency,
    'battery_charge_efficiency',
    true,
  );
  const dischargeEfficiency = decimal(
    data.battery_discharge_efficiency,
    'battery_discharge_efficiency',
    true,
  );
  const efficiencies: [string, Rational][] = [
    ['distribution_efficiency', distribution],
    ['battery_charge_efficiency', chargeEfficiency],
    ['battery_discharge_efficiency', dischargeEfficiency],
  ];
  for (const [name, value] of efficiencies) {
    if (value.compare(Rational.one()) > 0)
      throw new InputError(`${name}: expected an efficiency in (0, 1]`);
  }
  const tariff =
    data.tariff_per_kwh === null ? null : decimal(data.tariff_per_kwh, 'tariff_per_kwh');
  const generatorCost =
    data.generator_cost_per_kwh === null
      ? null
      : decimal(data.generator_cost_per_kwh, 'generator_cost_per_kwh');
  const batteryCapacity = decimal(data.battery_capacity_kwh, 'battery_capacity_kwh', true);
  const batteryInitial = decimal(data.battery_initial_kwh, 'battery_initial_kwh');
  const batteryCharge = decimal(data.battery_charge_kw, 'battery_charge_kw');
  if (batteryInitial.compare(batteryCapacity) > 0)
    throw new InputError('battery_initial_kwh exceeds stored-energy capacity');
  const source_ids = stringList(data.source_ids, 'source_ids');
  if (!Array.isArray(data.assets) || data.assets.length > 64)
    throw new InputError('assets: expected a bounded JSON array');
  if (!Array.isArray(data.dependencies) || data.dependencies.length > 256)
    throw new InputError('dependencies: expected a bounded JSON array');
  if (!Array.isArray(data.events) || data.events.length > 128)
    throw new InputError('events: expected a bounded JSON array');
  const assets = data.assets.map(asset);
  const dependencies = data.dependencies.map(dependency);
  const events = data.events.map(event);
  const byId = new Map(assets.map((item) => [item.id, item]));
  if (byId.size !== assets.length) throw new InputError('Asset identifiers must be unique');
  for (const kind of ['utility', 'generator', 'battery', 'load']) {
    if (assets.filter((item) => item.kind === kind).length !== 1)
      throw new InputError(`This model requires exactly one ${kind} asset`);
  }
  const batteryAsset = assets.find((item) => item.kind === 'battery')!;
  if (batteryCharge.compare(Rational.fromDecimal(batteryAsset.capacity_kw)) > 0)
    throw new InputError('battery_charge_kw exceeds the battery electrical power rating');
  const domains = new Set(assets.flatMap((item) => item.failure_domains));
  const seen = new Set<string>();
  for (const edge of dependencies) {
    if (!byId.has(edge.source) || !byId.has(edge.target))
      throw new InputError('Dependency refers to a missing asset');
    const key = `${edge.source}\u0000${edge.target}\u0000${edge.relation}`;
    if (seen.has(key)) throw new InputError('Duplicate dependency');
    seen.add(key);
    if (
      edge.relation === 'feeds' &&
      (['utility', 'generator', 'battery'].includes(byId.get(edge.target)!.kind) ||
        byId.get(edge.source)!.kind === 'load')
    )
      throw new InputError('Feeds must lead from sources toward the load');
    if (
      edge.relation === 'charges' &&
      (byId.get(edge.target)!.kind !== 'battery' || byId.get(edge.source)!.kind !== 'bus')
    )
      throw new InputError('Charging connections must lead from a bus to the battery');
  }
  if (dependencies.filter((edge) => edge.relation === 'charges').length !== 1)
    throw new InputError('Provide exactly one explicit bus-to-battery charging connection');
  topo(assets, dependencies, 'feeds');
  topo(assets, dependencies, 'requires');
  const load = assets.find((item) => item.kind === 'load')!.id;
  const chargingBus = dependencies.find((edge) => edge.relation === 'charges')!.source;
  for (const source of assets.filter((item) =>
    ['utility', 'generator', 'battery'].includes(item.kind),
  )) {
    const reachable = new Set([source.id]);
    for (const item of topo(assets, dependencies, 'feeds')) {
      if (reachable.has(item))
        for (const edge of dependencies)
          if (edge.relation === 'feeds' && edge.source === item) reachable.add(edge.target);
    }
    if (!reachable.has(load))
      throw new InputError(`Source ${source.id} has no feed path to the load`);
    if (source.kind === 'utility' && !reachable.has(chargingBus))
      throw new InputError('The charging bus has no utility feed path');
  }
  for (const item of events) {
    if (item.at_s >= duration_s)
      throw new InputError('Events must occur before the simulation end');
    const valid = item.action.startsWith('domain_') ? domains : byId;
    if (!valid.has(item.target))
      throw new InputError('Event refers to an unknown asset or failure domain');
    if (item.action === 'set_demand' && item.target !== load)
      throw new InputError('set_demand must target the load asset');
  }
  return {
    schema_version: 2,
    id: text(data.id, 'id'),
    name: text(data.name, 'name'),
    currency,
    duration_s,
    step_s,
    it_demand_kw: decimalText(it_demand),
    it_capacity_kw: decimalText(it_capacity),
    distribution_efficiency: decimalText(distribution),
    tariff_per_kwh: tariff === null ? null : decimalText(tariff),
    generator_cost_per_kwh: generatorCost === null ? null : decimalText(generatorCost),
    generator_start_delay_s,
    battery_capacity_kwh: decimalText(batteryCapacity),
    battery_initial_kwh: decimalText(batteryInitial),
    battery_charge_kw: decimalText(batteryCharge),
    battery_charge_efficiency: decimalText(chargeEfficiency),
    battery_discharge_efficiency: decimalText(dischargeEfficiency),
    source_ids,
    assets,
    dependencies,
    events,
  };
}

export function topologicalOrder(scenario: SiteScenario, relation: string): string[] {
  return topo(scenario.assets, scenario.dependencies, relation);
}

export function parseQuantity(value: string, name = 'value'): Rational {
  return Rational.fromDecimal(value, name);
}
