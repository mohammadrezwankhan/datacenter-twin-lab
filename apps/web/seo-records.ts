import { lessonPlanningScenario, lessonScenario, type Lesson } from './src/course-lessons';
import { simulateContinuitySync } from './src/js-engine/continuity';
import { simulatePlanning } from './src/js-engine/planning';
import { lessonValue } from './src/lesson-results';
import type { Run, SiteScenario } from './src/types';

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });

export function displayQuantity(value: unknown): string {
  if (value === null || value === undefined) return 'Not reached in this case';
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Invalid lesson result');
  return numberFormat.format(number);
}

/** Build-time records only: no extra calculation or download on the first-visit path. */
export function lessonRecords(lesson: Lesson, scenarios: Record<string, SiteScenario>) {
  return [lesson.initial, lesson.challenge].map((input, index) => {
    const run =
      lesson.id === 'pue'
        ? null
        : (simulateContinuitySync(lessonScenario(lesson, scenarios[lesson.preset], input)) as Run);
    const planning = lesson.id === 'pue' ? simulatePlanning(lessonPlanningScenario(input)) : null;
    const calculation = (run ?? planning)!;
    return {
      configuration: index ? 'challenge' : 'starting',
      input,
      result: lessonValue(lesson, run, planning) ?? null,
      unit: lesson.resultUnit,
      calculation,
    };
  });
}

export type EvidenceIndex = {
  version: string;
  manifest_path: string;
  receipt_path: string;
  cases: {
    id: string;
    title: string;
    input_sha256: string;
    run_id: string;
    run_path: string;
    scenario_path: string;
    report_path: string;
    equation: string;
    outcome: string;
  }[];
};
