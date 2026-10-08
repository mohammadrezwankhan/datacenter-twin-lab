import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessons } from './src/course-lessons.ts';
import { emtIntroduction } from './seo-emt.ts';
import { researchStudies } from './seo-research.ts';

export type LearningKind = 'continuity' | 'emt' | 'dynamics';
const sourceTextNormalization = 'UTF-8, CRLF normalized to LF' as const;

export type LearningRecord = {
  id: string;
  kind: LearningKind;
  sequence: number | null;
  title: string;
  question: string | null;
  description: string;
  tags: string[];
  modelFamily: string;
  overviewPath: string;
  runtimePath: string;
  sharedOverview: boolean;
  evidenceLinks: string[];
  sourceFiles: { path: string; sha256: string }[];
  contentSha256: string;
};

type LearningContent = Omit<LearningRecord, 'sourceFiles' | 'contentSha256'>;

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const continuitySources = [
  'apps/web/src/course-lessons.ts',
  'apps/web/src/js-engine/continuity.ts',
  'datacenter_twin/continuity.py',
  'docs/engineering/electrical-continuity.md',
  'tests/test_course_lessons.py',
];
const pueSources = [
  'apps/web/src/course-lessons.ts',
  'apps/web/src/js-engine/planning.ts',
  'datacenter_twin/contracts.py',
  'datacenter_twin/engine.py',
  'docs/engineering/course-studio.md',
  'tests/test_course_lessons.py',
];
const emtSources = [
  'apps/web/seo-emt.ts',
  'apps/web/src/emt/engine.ts',
  'datacenter_twin/emt.py',
  'docs/studies/emt.md',
  'tests/test_emt.py',
];
const dynamicsSources = [
  'apps/web/seo-research.ts',
  'apps/web/src/research/types.ts',
  'datacenter_twin/research/__init__.py',
  'tests/test_research.py',
  'docs/studies/power-dynamics.md',
];
const dynamicsModelSources: Record<string, string> = {
  'load-step': 'datacenter_twin/research/sdcib.py',
  modal: 'datacenter_twin/research/sdcib.py',
  'forced-response': 'datacenter_twin/research/sdcib.py',
  'model-comparison': 'datacenter_twin/research/model_comparison.py',
  'grid-network': 'datacenter_twin/research/grid_network.py',
};

function sourceFiles(paths: string[], cache: Map<string, string>) {
  return paths.map((path) => {
    let sha256 = cache.get(path);
    if (!sha256) {
      sha256 = createHash('sha256')
        .update(readFileSync(resolve(repositoryRoot, path), 'utf8').replace(/\r\n/g, '\n'), 'utf8')
        .digest('hex');
      cache.set(path, sha256);
    }
    return { path, sha256 };
  });
}

function withHashes(
  content: LearningContent,
  paths: string[],
  cache: Map<string, string>,
): LearningRecord {
  return {
    ...content,
    sourceFiles: sourceFiles(paths, cache),
    contentSha256: createHash('sha256').update(JSON.stringify(content), 'utf8').digest('hex'),
  };
}

export function buildLearningManifest(sourceRevision: string | null) {
  if (sourceRevision !== null && !/^[a-f0-9]{40}$/.test(sourceRevision))
    throw new Error('Invalid public source revision');
  const cache = new Map<string, string>();
  const items = [
    ...lessons.map((lesson, index) => {
      const isPue = lesson.id === 'pue';
      const overviewPath = `/learn/${lesson.id}/`;
      return withHashes(
        {
          id: lesson.id,
          kind: 'continuity',
          sequence: index + 1,
          title: lesson.title.replace(/^\d+\. /, ''),
          question: lesson.question,
          description: lesson.concept,
          tags: [lesson.concept],
          modelFamily: isPue ? 'annual-pue' : 'power-continuity',
          overviewPath,
          runtimePath: `/?lesson=${lesson.id}`,
          sharedOverview: false,
          evidenceLinks: [
            overviewPath,
            `${overviewPath}results.json`,
            ...(isPue
              ? ['docs/engineering/course-studio.md', 'tests/test_course_lessons.py']
              : ['docs/engineering/electrical-continuity.md', 'tests/test_course_lessons.py']),
          ],
        },
        isPue ? pueSources : continuitySources,
        cache,
      );
    }),
    withHashes(
      {
        id: 'emt',
        kind: 'emt',
        sequence: null,
        title: emtIntroduction.title,
        question: null,
        description: emtIntroduction.description,
        tags: ['EMT fundamentals', 'DC-link RLC'],
        modelFamily: 'dc-link-rlc',
        overviewPath: '/studies/emt/',
        runtimePath: '/?mode=emt',
        sharedOverview: false,
        evidenceLinks: [
          '/studies/emt/',
          '/studies/emt/default-result.json',
          'docs/studies/emt.md',
          'tests/test_emt.py',
        ],
      },
      emtSources,
      cache,
    ),
    ...researchStudies.map(([id, title, question, detail], index) =>
      withHashes(
        {
          id,
          kind: 'dynamics',
          sequence: index + 1,
          title,
          question,
          description: detail,
          tags: [title],
          modelFamily: 'power-dynamics',
          overviewPath: '/studies/power-dynamics/',
          runtimePath: `/?study=${id}`,
          sharedOverview: true,
          evidenceLinks: [
            '/studies/power-dynamics/',
            'docs/studies/power-dynamics.md',
            'tests/test_research.py',
          ],
        },
        [...dynamicsSources, dynamicsModelSources[id]],
        cache,
      ),
    ),
  ];
  const counts = { continuity: 0, emt: 0, dynamics: 0 };
  for (const item of items) counts[item.kind] += 1;
  return { schemaVersion: 1 as const, sourceRevision, sourceTextNormalization, counts, items };
}
