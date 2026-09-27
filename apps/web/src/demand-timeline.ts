import type { SiteScenario } from './types';
import { validateScenario, parseQuantity } from './js-engine/contract';
import { decimalText, Rational } from './js-engine/decimal';

export type DemandStep = {
  id: string;
  originalIndex: number | null;
  atS: string;
  demandKw: string;
};
export type DemandDraft = { initialKw: string; steps: DemandStep[] };

export function demandDraft(scenario: SiteScenario): DemandDraft {
  return {
    initialKw: scenario.it_demand_kw,
    steps: scenario.events.flatMap((event, index) =>
      event.action === 'set_demand'
        ? [
            {
              id: `event-${index}`,
              originalIndex: index,
              atS: String(event.at_s),
              demandKw: event.value_kw!,
            },
          ]
        : [],
    ),
  };
}

/** Replace demand events in their original slots; never reorder availability events.
 * Equal-time events retain engine order. New steps are appended, so the last
 * listed demand step at a shared time wins, including at time zero.
 */
export function scenarioWithDemand(current: SiteScenario, draft: DemandDraft): SiteScenario {
  const load = current.assets.find((asset) => asset.kind === 'load');
  if (!load) throw new Error('The scenario needs a load asset.');
  const steps = draft.steps.map((step, index) => {
    if (!/^\d+$/.test(step.atS.trim()))
      throw new Error(`Step ${index + 1}: enter a whole number of seconds.`);
    const at = Number(step.atS);
    if (!Number.isSafeInteger(at) || at < 0 || at >= current.duration_s)
      throw new Error(`Step ${index + 1}: time must be from 0 to ${current.duration_s - 1} s.`);
    let power: string;
    try {
      power = decimalText(parseQuantity(step.demandKw, `Step ${index + 1} demand (kW)`));
    } catch (error) {
      throw new Error((error as Error).message);
    }
    return { at_s: at, action: 'set_demand', target: load.id, value_kw: power };
  });
  const replacements = new Map(
    draft.steps.flatMap((step, index) =>
      step.originalIndex === null ? [] : [[step.originalIndex, steps[index]] as const],
    ),
  );
  const events = current.events.flatMap((event, index) =>
    event.action !== 'set_demand'
      ? [event]
      : replacements.has(index)
        ? [replacements.get(index)!]
        : [],
  );
  events.push(...steps.filter((_, index) => draft.steps[index].originalIndex === null));
  if (events.length > 128)
    throw new Error('A scenario supports at most 128 events, including failures and recoveries.');
  return validateScenario({ ...current, it_demand_kw: draft.initialKw, events });
}

/** Requested IT energy only: integrate the declared step schedule exactly.
 * This preview says nothing about supply, losses, storage or served energy.
 */
export function demandPreview(scenario: SiteScenario) {
  const changes = scenario.events
    .filter((event) => event.action === 'set_demand')
    .map((event, index) => ({ at: event.at_s, kw: event.value_kw!, index }))
    .sort((a, b) => a.at - b.at || a.index - b.index);
  let start = 0;
  let kw = scenario.it_demand_kw;
  let energy = Rational.zero();
  const segments: { start: number; end: number; kw: string }[] = [];
  for (const event of [...changes, { at: scenario.duration_s, kw, index: -1 }]) {
    if (event.at > start) {
      segments.push({ start, end: event.at, kw });
      energy = energy.add(
        parseQuantity(kw)
          .mul(Rational.fromInteger(event.at - start))
          .div(Rational.fromInteger(3600)),
      );
    }
    start = event.at;
    kw = event.kw;
  }
  return { segments, requestedKwh: decimalText(energy) };
}

export function nextStepTime(draft: DemandDraft, duration: number): number {
  const times = [
    0,
    ...draft.steps
      .map((step) => Number(step.atS))
      .filter((at) => Number.isInteger(at) && at >= 0 && at < duration),
    duration,
  ].sort((a, b) => a - b);
  let start = 0;
  let span = 0;
  for (let index = 1; index < times.length; index++) {
    if (times[index] - times[index - 1] > span) {
      start = times[index - 1];
      span = times[index] - start;
    }
  }
  return Math.min(duration - 1, start + Math.floor(span / 2));
}
