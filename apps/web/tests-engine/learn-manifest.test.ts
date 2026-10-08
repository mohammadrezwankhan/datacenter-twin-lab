import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lessons } from '../src/course-lessons.ts';
import { emtIntroduction } from '../seo-emt.ts';
import { researchStudies } from '../seo-research.ts';
import { buildLearningManifest } from '../learn-manifest.ts';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

test('manifest preserves the existing prose, categories and verified destinations', () => {
  const manifest = buildLearningManifest(null);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.sourceRevision, null);
  assert.equal(manifest.sourceTextNormalization, 'UTF-8, CRLF normalized to LF');
  assert.deepEqual(manifest.counts, { continuity: 12, emt: 1, dynamics: 5 });
  assert.equal(manifest.items.length, 18);
  assert.equal(new Set(manifest.items.map(({ id }) => id)).size, 18);

  for (const [index, lesson] of lessons.entries()) {
    const item = manifest.items[index];
    assert.equal(item.id, lesson.id);
    assert.equal(item.kind, 'continuity');
    assert.equal(item.sequence, index + 1);
    assert.equal(item.title, lesson.title.replace(/^\d+\. /, ''));
    assert.equal(item.question, lesson.question);
    assert.equal(item.description, lesson.concept);
    assert.deepEqual(item.tags, [lesson.concept]);
    assert.equal(item.modelFamily, lesson.id === 'pue' ? 'annual-pue' : 'power-continuity');
    assert.equal(item.overviewPath, `/learn/${lesson.id}/`);
    assert.equal(item.runtimePath, `/?lesson=${lesson.id}`);
    assert.equal(item.sharedOverview, false);
    assert.ok(item.evidenceLinks.includes(`/learn/${lesson.id}/results.json`));
  }
  assert.equal(manifest.items[11].modelFamily, 'annual-pue');

  const emt = manifest.items[12];
  assert.equal(emt.kind, 'emt');
  assert.equal(emt.sequence, null);
  assert.equal(emt.title, emtIntroduction.title);
  assert.equal(emt.question, null);
  assert.equal(emt.description, emtIntroduction.description);
  assert.equal(emt.overviewPath, '/studies/emt/');
  assert.equal(emt.runtimePath, '/?mode=emt');
  assert.equal(emt.sharedOverview, false);
  assert.ok(emt.evidenceLinks.includes('/studies/emt/default-result.json'));

  for (const [index, [id, title, question, detail]] of researchStudies.entries()) {
    const item = manifest.items[index + 13];
    assert.equal(item.id, id);
    assert.equal(item.kind, 'dynamics');
    assert.equal(item.sequence, index + 1);
    assert.equal(item.title, title);
    assert.equal(item.question, question);
    assert.equal(item.description, detail);
    assert.equal(item.modelFamily, 'power-dynamics');
    assert.equal(item.overviewPath, '/studies/power-dynamics/');
    assert.equal(item.runtimePath, `/?study=${id}`);
    assert.equal(item.sharedOverview, true);
  }
});

test('only the five power-dynamics records share a canonical overview', () => {
  const sourceRevision = 'a'.repeat(40);
  const manifest = buildLearningManifest(sourceRevision);
  const { items } = manifest;
  assert.equal(manifest.sourceRevision, sourceRevision);
  assert.throws(() => buildLearningManifest('A'.repeat(40)), /Invalid public source revision/);
  assert.throws(() => buildLearningManifest('not-a-revision'), /Invalid public source revision/);
  assert.equal(items[0].overviewPath, '/learn/power-energy/');
  const shared = items.filter(({ sharedOverview }) => sharedOverview);
  assert.equal(shared.length, 5);
  assert.ok(
    shared.every(
      ({ kind, overviewPath }) =>
        kind === 'dynamics' && overviewPath === '/studies/power-dynamics/',
    ),
  );
  const unique = items
    .filter(({ sharedOverview }) => !sharedOverview)
    .map(({ overviewPath }) => overviewPath);
  assert.equal(new Set(unique).size, unique.length);
  assert.equal(items[0].sourceFiles.length > 0, true);
});

test('source and display hashes are reproducible from their declared inputs', () => {
  const { items } = buildLearningManifest(null);
  for (const item of items) {
    for (const source of item.sourceFiles) {
      assert.match(source.sha256, /^[a-f0-9]{64}$/);
      assert.equal(
        source.sha256,
        sha256(readFileSync(resolve(repositoryRoot, source.path), 'utf8').replace(/\r\n/g, '\n')),
        source.path,
      );
    }
    const { sourceFiles: _sources, contentSha256, ...content } = item;
    assert.match(contentSha256, /^[a-f0-9]{64}$/);
    assert.equal(contentSha256, sha256(JSON.stringify(content)), item.id);
  }
});
