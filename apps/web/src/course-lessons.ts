import type { SiteScenario } from './types';

export type Lesson = {
  id: string;
  title: string;
  concept: string;
  question: string;
  preset: string;
  label: string;
  unit: string;
  initial: string;
  challenge: string;
  min: number;
  max: number;
  step: number;
  field: string;
  resultKey: string;
  resultUnit: string;
  explanation: string;
};

export const lessons: Lesson[] = [
  {
    id: 'power-energy',
    title: '1. Power becomes energy',
    concept: 'kW and kWh',
    question: 'How much energy does a constant load request in half an hour?',
    preset: 'normal',
    label: 'IT demand',
    unit: 'kW',
    initial: '1000',
    challenge: '500',
    min: 0,
    max: 1000,
    step: 100,
    field: 'it_demand_kw',
    resultKey: 'requested_it_kwh',
    resultUnit: 'kWh',
    explanation:
      'Energy equals power multiplied by time. At 1,000 kW for 0.5 h the request is 500 kWh; at 500 kW it is 250 kWh.',
  },
  {
    id: 'distribution-loss',
    title: '2. Account for distribution losses',
    concept: 'Efficiency',
    question: 'How much source power is needed to deliver 1,000 kW?',
    preset: 'normal',
    label: 'Distribution efficiency',
    unit: 'ratio',
    initial: '0.95',
    challenge: '0.90',
    min: 0.5,
    max: 1,
    step: 0.01,
    field: 'distribution_efficiency',
    resultKey: 'grid_kwh',
    resultUnit: 'kWh over 30 min',
    explanation:
      'Divide the IT demand by efficiency. At 0.95 the source supplies 1,052.631… kW; at 0.90 it supplies 1,111.111… kW.',
  },
  {
    id: 'ride-through',
    title: '3. Calculate battery ride-through',
    concept: 'Finite storage',
    question: 'Does half the stored energy give half the ride-through duration?',
    preset: 'generator_failure',
    label: 'Initial battery',
    unit: 'kWh',
    initial: '100',
    challenge: '50',
    min: 0,
    max: 100,
    step: 10,
    field: 'battery_initial_kwh',
    resultKey: 'depletion',
    resultUnit: 's elapsed',
    explanation:
      'Charging is disabled in this lesson. 100 kWh delivers 85.5 kWh after the two losses: 307.8 s of ride-through. 50 kWh gives 153.9 s, so depletion is at 453.9 s elapsed.',
  },
  {
    id: 'generator-delay',
    title: '4. Bridge generator startup',
    concept: 'Sequence and delay',
    question: 'What changes when startup takes 60 seconds instead of 30?',
    preset: 'utility_loss',
    label: 'Generator start delay',
    unit: 's',
    initial: '30',
    challenge: '60',
    min: 0,
    max: 600,
    step: 10,
    field: 'generator_start_delay_s',
    resultKey: 'generator_ready',
    resultUnit: 's elapsed',
    explanation:
      'A utility failure at 300 s requests a start. A 30 s delay makes the generator ready at 330 s; a 60 s delay makes it ready at 360 s. The battery bridges both in these inputs.',
  },
  {
    id: 'generator-failure',
    title: '5. Add a failed generator',
    concept: 'Combined failures',
    question: 'What changes if the generator cannot start?',
    preset: 'generator_failure',
    label: 'Generator available (0 = failed, 1 = available)',
    unit: '',
    initial: '0',
    challenge: '1',
    min: 0,
    max: 1,
    step: 1,
    field: 'generator_available',
    resultKey: 'unserved_duration_s',
    resultUnit: 's unserved',
    explanation:
      'With the generator failed, the battery empties at 607.8 s and service is lost for 292.2 s. An available generator starts after 30 s and avoids that gap.',
  },
  {
    id: 'n-plus-one',
    title: '6. Check a surviving path',
    concept: 'N+1 capacity reasoning',
    question: 'Are two paths enough when either one must carry the whole load?',
    preset: 'path_maintenance',
    label: 'Each path gross capacity',
    unit: 'kW',
    initial: '700',
    challenge: '1100',
    min: 100,
    max: 1500,
    step: 100,
    field: 'path_capacity',
    resultKey: 'peak_unserved_kw',
    resultUnit: 'kW unserved',
    explanation:
      'One 700 kW path delivers 665 kW after losses, leaving 335 kW unmet. One 1,100 kW path can deliver the full 1,000 kW request. This tests a capacity condition, not a complete N+1 classification.',
  },
  {
    id: 'shared-controls',
    title: '7. Expose shared control failures',
    concept: 'Failure domains',
    question: 'Can a shared control fault defeat both power paths?',
    preset: 'shared_domain',
    label: 'Path B shares failed controls (0 = no, 1 = yes)',
    unit: '',
    initial: '1',
    challenge: '0',
    min: 0,
    max: 1,
    step: 1,
    field: 'shared_controls',
    resultKey: 'peak_unserved_kw',
    resultUnit: 'kW unserved',
    explanation:
      'Both paths share the failed control domain initially: 1,000 kW is unmet. Removing that dependency from path B preserves its 665 kW delivery, leaving 335 kW unmet.',
  },
  {
    id: 'single-point',
    title: '8. Find a single point of failure',
    concept: 'Common upstream assets',
    question: 'What happens to two paths when their common main bus fails?',
    preset: 'normal',
    label: 'Main bus available (0 = failed, 1 = available)',
    unit: '',
    initial: '0',
    challenge: '1',
    min: 0,
    max: 1,
    step: 1,
    field: 'main_bus_available',
    resultKey: 'unserved_it_kwh',
    resultUnit: 'kWh unserved',
    explanation:
      'The common bus outage lasts 600 s. Even with two downstream paths, 1,000 × 600/3,600 = 166.666… kWh is unserved. Keeping the bus available removes the interruption.',
  },
  {
    id: 'precharge',
    title: '9. Track energy before the outage',
    concept: 'Opening balances',
    question: 'Why does the 50 kWh case last longer when it can charge first?',
    preset: 'generator_failure',
    label: 'Battery charging power',
    unit: 'kW',
    initial: '100',
    challenge: '0',
    min: 0,
    max: 100,
    step: 10,
    field: 'battery_charge_kw',
    resultKey: 'depletion',
    resultUnit: 's elapsed',
    explanation:
      'The battery starts at 50 kWh. Before the 300 s outage it gains 7.9166… kWh at 100 kW charging power. Depletion is at 478.2675 s; with charging disabled it is at 453.9 s.',
  },
  {
    id: 'ai-outage',
    title: '10. Interrupt a 50 MW AI cluster',
    concept: 'Aggregate AI power demand',
    question: 'How long can 5 MWh of stored energy bridge a 50 MW load?',
    preset: 'ai_cluster_generator_failure',
    label: 'Initial battery',
    unit: 'kWh',
    initial: '5000',
    challenge: '2500',
    min: 0,
    max: 5000,
    step: 500,
    field: 'battery_initial_kwh',
    resultKey: 'depletion',
    resultUnit: 's elapsed',
    explanation:
      'Scaling the electrical ratings and storage by 50 preserves the 307.8 s ride-through duration. Halving initial reserve gives depletion at 478.2675 s with pre-outage charging. This is aggregate demand, not GPU job or grid adequacy simulation.',
  },
  {
    id: 'recovery-deadline',
    title: '11. Catch a sub-second service gap',
    concept: 'Exact event timing',
    question: 'Does 57 kWh bridge recovery at 500 seconds? Does 58 kWh?',
    preset: 'generator_failure',
    label: 'Initial battery',
    unit: 'kWh',
    initial: '57',
    challenge: '58',
    min: 50,
    max: 65,
    step: 1,
    field: 'battery_initial_kwh',
    resultKey: 'unserved_duration_s',
    resultUnit: 's unserved',
    explanation:
      '57 kWh depletes at 499.8135 s, leaving a 0.1865 s gap before recovery. 58 kWh bridges the outage. The engine resolves the event inside its nominal 10 s step.',
  },
  {
    id: 'pue',
    title: '12. Separate PUE from continuity',
    concept: 'Facility energy planning',
    question: 'How does assumed PUE change annual energy for the same 50 MW IT load?',
    preset: 'normal',
    label: 'Assumed PUE',
    unit: 'ratio',
    initial: '1.25',
    challenge: '1.15',
    min: 1,
    max: 2,
    step: 0.05,
    field: 'pue',
    resultKey: 'facility_energy_kwh',
    resultUnit: 'kWh per 8,760 h',
    explanation:
      '50,000 × 8,760 × 1.25 = 547,500,000 kWh; at 1.15 it is 503,700,000 kWh. The difference is 43,800,000 kWh at identical IT demand. PUE already includes non-IT overhead: do not add continuity losses to it again.',
  },
];

export function lessonScenario(lesson: Lesson, base: SiteScenario, value: string): SiteScenario {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < lesson.min || parsed > lesson.max)
    throw new Error(`${lesson.label}: enter a value from ${lesson.min} to ${lesson.max}`);
  if (lesson.step >= 1 && !Number.isInteger(parsed)) throw new Error('Enter a whole number.');
  const scenario = structuredClone(base);
  scenario.id = `course-${lesson.id}`;
  scenario.name = lesson.title;
  scenario.source_ids = [...new Set([...scenario.source_ids, 'EDU-POWER-001'])];
  if (lesson.id === 'ride-through') scenario.battery_charge_kw = '0';
  if (lesson.id === 'precharge') scenario.battery_initial_kwh = '50';
  if (lesson.id === 'recovery-deadline')
    scenario.events = scenario.events.map((event) =>
      event.target === 'utility' && event.action === 'asset_up' ? { ...event, at_s: 500 } : event,
    );
  switch (lesson.field) {
    case 'generator_available':
      if (parsed === 1)
        scenario.events = scenario.events.filter((event) => event.target !== 'generator');
      break;
    case 'path_capacity':
      scenario.assets = scenario.assets.map((asset) =>
        asset.kind === 'distribution' ? { ...asset, capacity_kw: value } : asset,
      );
      break;
    case 'shared_controls':
      if (parsed === 0)
        scenario.assets = scenario.assets.map((asset) =>
          asset.id === 'path-b'
            ? {
                ...asset,
                failure_domains: asset.failure_domains.filter(
                  (domain) => domain !== 'shared-controls',
                ),
              }
            : asset,
        );
      break;
    case 'main_bus_available':
      scenario.events =
        parsed === 0
          ? [
              { at_s: 300, action: 'asset_down', target: 'main-bus', value_kw: null },
              { at_s: 900, action: 'asset_up', target: 'main-bus', value_kw: null },
            ]
          : [];
      break;
    case 'generator_start_delay_s':
      scenario.generator_start_delay_s = parsed;
      break;
    case 'pue':
      break;
    default:
      Object.assign(scenario, { [lesson.field]: value });
  }
  return scenario;
}
