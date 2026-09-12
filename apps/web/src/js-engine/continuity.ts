import { canonicalJson, compareUnicode, sha256Hex } from './canonical';
import { decimalText, InputError, moneyText, Rational } from './decimal';
import { parseQuantity, topologicalOrder, validateScenario } from './contract';
import type { Asset, Interval, Run, SiteScenario } from './types';
import { ENGINE_VERSION } from './version';

const MODEL = 'single_load_electrical_continuity_v1' as const;
const zero = () => Rational.zero();
const quantity = (value: string | number): Rational =>
  typeof value === 'number' ? Rational.fromInteger(value) : parseQuantity(value);
const min = (left: Rational, right: Rational) => (left.compare(right) <= 0 ? left : right);
const max = (left: Rational, right: Rational) => (left.compare(right) >= 0 ? left : right);

export class FlowNetwork {
  readonly residual = new Map<string, Map<string, Rational>>();
  readonly capacity = new Map<string, Rational>();

  private key(source: string, target: string): string {
    return `${source}\u0000${target}`;
  }

  add(source: string, target: string, capacity: Rational): void {
    if (!this.residual.has(source)) this.residual.set(source, new Map());
    if (!this.residual.has(target)) this.residual.set(target, new Map());
    this.residual.get(source)!.set(target, capacity);
    this.residual.get(target)!.set(source, zero());
    this.capacity.set(this.key(source, target), capacity);
  }

  flow(source: string, target: string): Rational {
    return this.capacity
      .get(this.key(source, target))!
      .sub(this.residual.get(source)!.get(target)!);
  }

  augment(): void {
    while (true) {
      const parents = new Map<string, string | null>([['SOURCE', null]]);
      const queue = ['SOURCE'];
      while (queue.length && !parents.has('SINK')) {
        const current = queue.shift()!;
        const edges = Array.from(this.residual.get(current)?.keys() ?? []).sort(compareUnicode);
        for (const target of edges) {
          if (!parents.has(target) && this.residual.get(current)!.get(target)!.isPositive()) {
            parents.set(target, current);
            queue.push(target);
          }
        }
      }
      if (!parents.has('SINK')) return;
      let current = 'SINK';
      let amount: Rational | null = null;
      while (parents.get(current) !== null) {
        const previous = parents.get(current)!;
        const value = this.residual.get(previous)!.get(current)!;
        amount = amount === null ? value : min(amount, value);
        current = previous;
      }
      current = 'SINK';
      while (parents.get(current) !== null) {
        const previous = parents.get(current)!;
        const forward = this.residual.get(previous)!.get(current)!;
        const backward = this.residual.get(current)!.get(previous)!;
        this.residual.get(previous)!.set(current, forward.sub(amount!));
        this.residual.get(current)!.set(previous, backward.add(amount!));
        current = previous;
      }
    }
  }
}

const limitations = [
  'No switching transient, protection study, cooling, workload queue or certification model.',
  'Generator starts on utility-asset unavailability only; downstream path faults do not request a start.',
  'Generator fuel is assumed sufficient for this horizon; its unit energy cost may be unknown.',
  'Initial stored battery energy is an opening balance; prior charging cost is excluded.',
  'Prices are illustrative inputs; costs exclude CAPEX and non-energy charges.',
];

function text(value: Rational): string {
  return decimalText(value);
}

function eventValue(event: SiteScenario['events'][number]): Record<string, string | number | null> {
  return { at_s: event.at_s, action: event.action, target: event.target, value_kw: event.value_kw };
}

/** Synchronous implementation used by the public async API and differential tests. */
export function simulateValidated(scenario: SiteScenario): Run {
  const canonical = canonicalJson(scenario as never);
  const digest = sha256Hex(canonical);
  const runId = sha256Hex(`continuity-v1:${ENGINE_VERSION}:${digest}`).slice(0, 20);
  const assets = new Map(scenario.assets.map((asset) => [asset.id, asset]));
  const utility = scenario.assets.find((asset) => asset.kind === 'utility')!.id;
  const generator = scenario.assets.find((asset) => asset.kind === 'generator')!.id;
  const battery = scenario.assets.find((asset) => asset.kind === 'battery')!.id;
  const load = scenario.assets.find((asset) => asset.kind === 'load')!.id;
  const requiresOrder = topologicalOrder(scenario, 'requires');
  const incomingRequires = new Map<string, string[]>(
    scenario.assets.map((asset) => [asset.id, []]),
  );
  for (const edge of scenario.dependencies)
    if (edge.relation === 'requires') incomingRequires.get(edge.target)!.push(edge.source);
  const schedule = scenario.events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => left.event.at_s - right.event.at_s || left.index - right.index);
  const directDown = new Set<string>();
  const domainsDown = new Set<string>();
  let eventIndex = 0;
  let now = zero();
  let demand = quantity(scenario.it_demand_kw);
  let energy = quantity(scenario.battery_initial_kwh);
  const capacity = quantity(scenario.battery_capacity_kwh);
  const eta = quantity(scenario.distribution_efficiency);
  const chargeEta = quantity(scenario.battery_charge_efficiency);
  const dischargeEta = quantity(scenario.battery_discharge_efficiency);
  let readyAt: Rational | null = null;
  const rows: Interval[] = [];
  const log: Record<string, unknown>[] = [];
  const totalKeys = [
    'requested_it_kwh',
    'served_it_kwh',
    'unserved_it_kwh',
    'grid_kwh',
    'generator_kwh',
    'distribution_loss_kwh',
    'battery_charge_loss_kwh',
    'battery_discharge_loss_kwh',
    'battery_stored_change_kwh',
    'unserved_duration_s',
  ];
  const totals = new Map(totalKeys.map((key) => [key, zero()]));
  let peakUnserved = zero();
  while (now.compare(Rational.fromInteger(scenario.duration_s)) < 0) {
    if (rows.length > 5000) throw new InputError('Simulation exceeded its interval budget');
    while (
      eventIndex < schedule.length &&
      now.compare(Rational.fromInteger(schedule[eventIndex].event.at_s)) === 0
    ) {
      const scheduled = schedule[eventIndex];
      const current = scheduled.event;
      if (current.action === 'asset_down') directDown.add(current.target);
      else if (current.action === 'asset_up') directDown.delete(current.target);
      else if (current.action === 'domain_down') domainsDown.add(current.target);
      else if (current.action === 'domain_up') domainsDown.delete(current.target);
      else demand = quantity(current.value_kw!);
      log.push({
        ...eventValue(current),
        at_s: text(Rational.fromInteger(current.at_s)),
        sequence: scheduled.index,
        origin: 'scenario_event',
      });
      eventIndex += 1;
    }
    const available = new Map<string, boolean>();
    for (const id of requiresOrder) {
      const asset = assets.get(id)!;
      const okay =
        !directDown.has(id) &&
        !asset.failure_domains.some((domain) => domainsDown.has(domain)) &&
        incomingRequires.get(id)!.every((source) => available.get(source));
      available.set(id, okay);
    }
    if (available.get(utility) || !available.get(generator)) {
      readyAt = null;
    } else if (readyAt === null) {
      readyAt = now.add(Rational.fromInteger(scenario.generator_start_delay_s));
      log.push({
        at_s: text(now),
        action: 'generator_start_requested',
        target: generator,
        ready_at_s: text(readyAt),
        origin: 'simulation',
      });
    }
    const running = readyAt !== null && now.compare(readyAt) >= 0 && available.get(generator);
    let boundary = min(
      now.add(Rational.fromInteger(scenario.step_s)),
      Rational.fromInteger(scenario.duration_s),
    );
    if (eventIndex < schedule.length)
      boundary = min(boundary, Rational.fromInteger(schedule[eventIndex].event.at_s));
    if (readyAt !== null && readyAt.compare(now) > 0) boundary = min(boundary, readyAt);

    const network = new FlowNetwork();
    const infinity = scenario.assets.reduce(
      (total, asset) => total.add(quantity(asset.capacity_kw)),
      zero(),
    );
    for (const id of Array.from(assets.keys()).sort(compareUnicode))
      network.add(
        `in:${id}`,
        `out:${id}`,
        available.get(id) ? quantity(assets.get(id)!.capacity_kw) : zero(),
      );
    for (const edge of scenario.dependencies
      .slice()
      .sort(
        (left, right) =>
          compareUnicode(left.source, right.source) ||
          compareUnicode(left.target, right.target) ||
          compareUnicode(left.relation, right.relation),
      ))
      if (edge.relation === 'feeds')
        network.add(`out:${edge.source}`, `in:${edge.target}`, infinity);
    network.add(`out:${load}`, 'SINK', demand.div(eta));
    for (const [source, enabled] of [
      [utility, available.get(utility)],
      [generator, running],
      [battery, energy.isPositive() && available.get(battery)],
    ] as [string, boolean | undefined][]) {
      network.add(
        'SOURCE',
        `in:${source}`,
        enabled ? quantity(assets.get(source)!.capacity_kw) : zero(),
      );
      network.augment();
    }
    const grossLoad = network.flow(`out:${load}`, 'SINK');
    const batteryKw = network.flow('SOURCE', `in:${battery}`);
    const generatorKw = network.flow('SOURCE', `in:${generator}`);
    let chargingKw = zero();
    if (
      batteryKw.isZero() &&
      generatorKw.isZero() &&
      available.get(utility) &&
      available.get(battery) &&
      energy.compare(capacity) < 0
    ) {
      for (const source of [generator, battery]) {
        network.residual.get('SOURCE')!.set(`in:${source}`, zero());
        network.capacity.set(`SOURCE\u0000in:${source}`, zero());
      }
      const chargingEdge = scenario.dependencies.find((edge) => edge.relation === 'charges')!;
      network.add(`out:${chargingEdge.source}`, 'CHARGER', quantity(scenario.battery_charge_kw));
      network.add('CHARGER', 'SINK', quantity(scenario.battery_charge_kw));
      network.augment();
      chargingKw = network.flow('CHARGER', 'SINK');
    }
    const gridKw = network.flow('SOURCE', `in:${utility}`);
    if (batteryKw.isPositive())
      boundary = min(
        boundary,
        now.add(energy.mul(dischargeEta).div(batteryKw).mul(Rational.fromInteger(3600))),
      );
    if (chargingKw.isPositive())
      boundary = min(
        boundary,
        now.add(
          capacity.sub(energy).div(chargingKw.mul(chargeEta)).mul(Rational.fromInteger(3600)),
        ),
      );
    const seconds = boundary.sub(now);
    if (seconds.compare(zero()) <= 0) throw new Error('Non-progressing simulation boundary');
    const hours = seconds.div(Rational.fromInteger(3600));
    const previousEnergy = energy;
    const batteryOut = batteryKw.mul(hours).div(dischargeEta);
    const batteryIn = chargingKw.mul(hours).mul(chargeEta);
    energy = energy.sub(batteryOut).add(batteryIn);
    const served = grossLoad.mul(eta);
    const unserved = demand.sub(served);
    const values = new Map<string, Rational>([
      ['requested_it_kwh', demand.mul(hours)],
      ['served_it_kwh', served.mul(hours)],
      ['unserved_it_kwh', unserved.mul(hours)],
      ['grid_kwh', gridKw.mul(hours)],
      ['generator_kwh', generatorKw.mul(hours)],
      ['distribution_loss_kwh', grossLoad.sub(served).mul(hours)],
      ['battery_charge_loss_kwh', chargingKw.mul(hours).sub(batteryIn)],
      ['battery_discharge_loss_kwh', batteryOut.sub(batteryKw.mul(hours))],
      ['battery_stored_change_kwh', energy.sub(previousEnergy)],
      ['unserved_duration_s', unserved.isPositive() ? seconds : zero()],
    ]);
    const residual = values
      .get('grid_kwh')!
      .add(values.get('generator_kwh')!)
      .sub(values.get('battery_stored_change_kwh')!)
      .sub(values.get('served_it_kwh')!)
      .sub(values.get('distribution_loss_kwh')!)
      .sub(values.get('battery_charge_loss_kwh')!)
      .sub(values.get('battery_discharge_loss_kwh')!);
    if (
      !residual.isZero() ||
      energy.compare(zero()) < 0 ||
      energy.compare(capacity) > 0 ||
      unserved.compare(zero()) < 0
    )
      throw new Error('Electrical energy invariant violated');
    for (const [key, value] of values) totals.set(key, totals.get(key)!.add(value));
    peakUnserved = max(peakUnserved, unserved);
    const warnings: string[] = [];
    if (unserved.isPositive()) warnings.push('UNSERVED_IT_LOAD');
    if (demand.compare(quantity(scenario.it_capacity_kw)) > 0)
      warnings.push('IT_ENVELOPE_EXCEEDED');
    if (!available.get(utility)) warnings.push('UTILITY_UNAVAILABLE');
    if (energy.isZero()) warnings.push('BATTERY_EMPTY');
    if (domainsDown.size) warnings.push('SHARED_DOMAIN_OUTAGE');
    const assetStates: Record<string, string> = {};
    for (const asset of scenario.assets)
      assetStates[asset.id] = available.get(asset.id) ? 'available' : 'unavailable';
    if (available.get(generator))
      assetStates[generator] = running ? 'running' : readyAt !== null ? 'starting' : 'standby';
    if (available.get(battery))
      assetStates[battery] = batteryKw.isPositive()
        ? 'discharging'
        : chargingKw.isPositive()
          ? 'charging'
          : energy.isZero()
            ? 'empty'
            : 'ready';
    if (available.get(load))
      assetStates[load] =
        served.isZero() && demand.isPositive()
          ? 'unserved'
          : unserved.isPositive()
            ? 'degraded'
            : 'served';
    const energyObject: Record<string, string> = {};
    for (const [key, value] of values) energyObject[key] = text(value);
    const tariff = scenario.tariff_per_kwh === null ? null : quantity(scenario.tariff_per_kwh);
    rows.push({
      start_s: text(now),
      end_s: text(boundary),
      duration_s: text(seconds),
      requested_it_kw: text(demand),
      served_it_kw: text(served),
      unserved_it_kw: text(unserved),
      electrical_source_kw: text(gridKw.add(generatorKw).add(batteryKw)),
      grid_kw: text(gridKw),
      generator_kw: text(generatorKw),
      battery_discharge_kw: text(batteryKw),
      battery_charge_kw: text(chargingKw),
      battery_start_kwh: text(previousEnergy),
      battery_end_kwh: text(energy),
      it_capacity_margin_kw: text(quantity(scenario.it_capacity_kw).sub(demand)),
      grid_energy_charge_to_date:
        tariff === null ? null : moneyText(totals.get('grid_kwh')!.mul(tariff)),
      energy: energyObject,
      energy_balance_residual_kwh: '0',
      asset_states: assetStates,
      warnings,
      feed_flows_kw: scenario.dependencies
        .filter((edge) => edge.relation === 'feeds')
        .map((edge) => ({
          source: edge.source,
          target: edge.target,
          kw: text(network.flow(`out:${edge.source}`, `in:${edge.target}`)),
        })),
    });
    if (energy.isZero() && previousEnergy.isPositive())
      log.push({
        at_s: text(boundary),
        action: 'battery_depleted',
        target: battery,
        origin: 'simulation',
      });
    now = boundary;
  }
  const gridCost =
    scenario.tariff_per_kwh === null
      ? null
      : totals.get('grid_kwh')!.mul(quantity(scenario.tariff_per_kwh));
  const generatorCost = totals.get('generator_kwh')!.isZero()
    ? zero()
    : scenario.generator_cost_per_kwh === null
      ? null
      : totals.get('generator_kwh')!.mul(quantity(scenario.generator_cost_per_kwh));
  const summary: Record<string, unknown> = {};
  for (const key of totalKeys) summary[key] = text(totals.get(key)!);
  summary.battery_final_kwh = text(energy);
  summary.peak_unserved_kw = text(peakUnserved);
  summary.energy_balance_residual_kwh = '0';
  summary.grid_energy_charge = moneyText(gridCost);
  summary.generator_energy_charge = moneyText(generatorCost);
  summary.total_incremental_energy_charge =
    gridCost === null || generatorCost === null ? null : moneyText(gridCost.add(generatorCost));
  summary.cost_status =
    gridCost === null || generatorCost === null ? 'unknown_component' : 'illustrative';
  summary.service_status = totals.get('unserved_it_kwh')!.isPositive()
    ? 'unserved_load'
    : 'served_throughout';
  summary.interval_count = rows.length;
  return {
    schema_version: 2,
    model: MODEL,
    engine_version: ENGINE_VERSION,
    run_id: runId,
    input_sha256: digest,
    mode: 'SIMULATED',
    quality: 'synthetic_uncalibrated',
    scenario,
    intervals: rows,
    events: log as Record<string, never>[],
    summary: summary as Run['summary'],
    boundary:
      'Electrical supply, stored battery energy, conversion losses and served IT; cooling excluded',
    limitations,
  };
}

export async function simulateContinuity(input: unknown): Promise<Run> {
  return simulateValidated(validateScenario(input));
}

export function simulateContinuitySync(input: unknown): Run {
  return simulateValidated(validateScenario(input));
}
