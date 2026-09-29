import type { Lesson } from './course-lessons';
import type { PlanningRun, Run } from './types';

export type LessonValue = string | number | null | undefined;

// The screen, printable worksheet and readable notes select the same completed result.
export function lessonValue(
  lesson: Lesson,
  run: Run | null,
  planning: Pick<PlanningRun, 'facility_energy_kwh'> | null,
): LessonValue {
  if (planning) return planning.facility_energy_kwh;
  if (!run) return undefined;
  if (lesson.resultKey === 'depletion')
    return run.events.find((event) => event.action === 'battery_depleted')?.at_s;
  if (lesson.resultKey === 'generator_ready') {
    const generator = run.scenario.assets.find((asset) => asset.kind === 'generator')?.id;
    return run.intervals.find((row) => generator && row.asset_states[generator] === 'running')
      ?.start_s;
  }
  return run.summary[lesson.resultKey];
}
