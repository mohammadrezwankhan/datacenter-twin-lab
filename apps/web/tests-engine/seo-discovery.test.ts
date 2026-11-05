import assert from 'node:assert/strict';
import { test } from 'node:test';
const { default: site } = await import('../site.config.json', { with: { type: 'json' } });
import { courseCatalog } from '../src/curriculum.ts';
import { ENGINE_VERSION } from '../src/js-engine/version.ts';
import {
  buildDiscoveryDocuments,
  createCourseSchema,
  createSoftwareApplicationSchema,
} from '../seo-discovery.ts';

const author = {
  '@type': 'Person' as const,
  '@id': 'https://mrkhan.co.technology/#person',
  name: site.author,
  url: 'https://mrkhan.co.technology/',
  sameAs: 'https://github.com/mohammadrezwankhan',
};
const base = site.url;
const repository = 'https://github.com/mohammadrezwankhan/datacenter-twin-lab';
const course = createCourseSchema({
  base,
  name: 'Power Systems for Datacenter Engineers',
  description: `Learn datacenter continuity and Infrastructure Engineering with ${String(courseCatalog.length)} free browser lessons, EMT and power-dynamics studies. Inspect assumptions, run educational screens and reproduce the evidence.`,
  author,
  license: `${repository}/blob/v${ENGINE_VERSION}/LICENSE`,
  lessons: courseCatalog,
});
const softwareApplication = createSoftwareApplicationSchema({
  base,
  name: site.name,
  version: ENGINE_VERSION,
  author,
  license: `${repository}/blob/v${ENGINE_VERSION}/LICENSE`,
  description:
    'A local-first educational power-continuity what-if simulator with finite battery energy, generator delay and failure, surviving-path capacity, and reproducible exports. Scenarios are synthetic and uncalibrated; results are illustrative, not facility predictions or equipment ratings. The separate EMT study uses a simplified DC-equivalent R-L-C circuit with a resistive load; it does not model inverter controls, ATS transfer behavior, generator synchronization, or protection operation.',
});
const documents = buildDiscoveryDocuments({
  base,
  siteName: site.name,
  repository,
  author,
  course,
  softwareApplication,
});

void test('course discovery entries exactly follow the current canonical curriculum', () => {
  assert.equal(course['@id'], `${base}learn/#course`);
  assert.deepEqual(
    course.hasPart,
    courseCatalog.map((lesson) => ({
      '@type': 'LearningResource',
      '@id': `${base}${lesson.readingRoute}#lesson`,
      name: lesson.title,
      url: `${base}${lesson.readingRoute}`,
    })),
  );

  const lines = documents.llmsText.split('\n');
  for (const lesson of courseCatalog) {
    assert.ok(
      lines.includes(`- [${lesson.title}](${base}${lesson.readingRoute})`),
      `llms.txt should link the current ${lesson.id} lesson`,
    );
  }
  assert.doesNotMatch(documents.llmsText, /12[- ]lesson|12 lessons/i);
});

void test('JSON discovery graph reuses canonical site entities and current engine version', () => {
  assert.equal(author['@id'], 'https://mrkhan.co.technology/#person');
  assert.equal(author.url, 'https://mrkhan.co.technology/');

  const json = JSON.parse(documents.knowledgeGraphJson) as {
    '@graph': Array<Record<string, unknown>>;
  };
  const jsonld: unknown = JSON.parse(documents.knowledgeGraphJsonLd);
  assert.deepEqual(jsonld, json);

  const person = json['@graph'].find((entity) => entity['@type'] === 'Person');
  const graphCourse = json['@graph'].find((entity) => entity['@type'] === 'Course');
  const software = json['@graph'].find((entity) => entity['@type'] === 'SoftwareApplication');
  assert.deepEqual(person, author);
  assert.deepEqual(graphCourse, course);
  assert.equal(software?.softwareVersion, ENGINE_VERSION);
  assert.equal(documents.llmsText.includes(`Software version: ${ENGINE_VERSION}`), true);
});

void test('discovery copy states the synthetic model scope without asserting unsupported EMT behavior', () => {
  const graph = JSON.parse(documents.knowledgeGraphJson) as {
    '@graph': Array<Record<string, unknown>>;
  };
  const software = graph['@graph'].find((entity) => entity['@type'] === 'SoftwareApplication');
  assert.match(String(software?.description), /synthetic and uncalibrated/i);
  assert.match(String(software?.description), /does not model inverter controls/i);
  assert.match(String(software?.description), /generator synchronization/i);

  assert.match(documents.llmsText, /synthetic/i);
  assert.match(documents.llmsText, /uncalibrated/i);
  assert.match(documents.llmsText, /DC-equivalent circuit with R, L, C and a resistive load/i);
  assert.match(documents.llmsText, /does not model inverter controls/i);
  assert.match(documents.llmsText, /generator synchronization/i);
  assert.doesNotMatch(
    documents.llmsText,
    /ATS dead time|under-voltage protection trip|typical(?:ly)?\s+0\.8[45]/i,
  );

  for (const url of [
    'https://mkgrid.co.technology/',
    'https://mktrade.co.business/',
    'https://mklab.co.technology/',
  ])
    assert.ok(documents.llmsText.includes(url), `retain discoverability link ${url}`);
});
