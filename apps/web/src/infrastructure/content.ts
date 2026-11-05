import { requiredValue } from '../required-value';
import type { LessonEvidence, ModelName, ScreenInputs } from './screens';

export type EvidenceLabel =
  | 'source-statement'
  | 'editorial-derivation'
  | 'illustrative-assumption'
  | 'unresolved';
export interface InfrastructureLesson extends LessonEvidence {
  number: number;
  chapter: number;
  title: string;
  trackId: 'infrastructure';
  estimatedMinutes: number;
  readingRoute: string;
  prerequisites: string[];
  lead: string;
  objectives: string[];
  sections: { title: string; body: string; evidenceLabel: EvidenceLabel }[];
  experiment: {
    model: ModelName;
    defaultInputs: ScreenInputs;
    challenge: { changes: ScreenInputs; question: string; answer: string };
    predictionRequired: boolean;
    explicitRunRequired: true;
    instructions: string[];
  };
  scene: {
    id: string;
    title: string;
    storyboard: string[];
    interaction: string;
    staticAlternative: string;
    timelineSemantics: string;
    reducedMotion: string;
  };
  assessments: { id: string; question: string; answer: string; rubric: string; source: string }[];
  limits: string[];
  publicUseStatus: string;
}
export const evidenceLabels: Record<EvidenceLabel, string> = {
  'source-statement': 'Source statement',
  'editorial-derivation': 'Editorial derivation',
  'illustrative-assumption': 'Illustrative assumption',
  unresolved: 'Unresolved',
};
const modules = import.meta.glob('./content/*.json');
export async function loadInfrastructureLesson(id: string): Promise<InfrastructureLesson> {
  const path = Object.keys(modules).find((key) => key.endsWith(`-${id}.json`));
  if (!path) throw new Error('Unknown infrastructure lesson');
  const module = (await requiredValue(modules[path], 'modules[path]')()) as {
    default: InfrastructureLesson;
  };
  return module.default;
}
