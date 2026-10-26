import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { stageLocalEvidenceAssets } from '../local-evidence-assets.ts';

const version = '2.0.0';
const artifact = 'current.json';
const media = [
  'docs/images/guide-preview.png',
  'docs/images/proof-demo.webm',
  'docs/images/proof-demo.vtt',
  'apps/web/public/THIRD-PARTY-NOTICES.txt',
  'apps/web/public/favicon.png',
];

function fixture(t: test.TestContext) {
  const root = mkdtempSync(resolve(tmpdir(), 'twin-stage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name: string, bytes: string) => {
    const path = resolve(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  };
  const bytes = '{"synthetic":true}\n';
  const manifest = {
    engine_version: version,
    artifacts: { [artifact]: { sha256: createHash('sha256').update(bytes).digest('hex') } },
  };
  const saveManifest = () =>
    write(`data/evidence/v${version}/manifest.json`, JSON.stringify(manifest));
  write(`data/evidence/v${version}/${artifact}`, bytes);
  saveManifest();
  write(`data/evidence/index-v${version}.json`, '{"current":true}\n');
  write('data/evidence/v1.0.0/historical.json', '{"historical":true}\n');
  for (const path of media) write(path, `synthetic ${path}\n`);
  return { root, write, manifest, saveManifest };
}

function snapshot(directory: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = resolve(entry.parentPath, entry.name);
        return [
          relative(directory, path).replaceAll('\\', '/'),
          readFileSync(path).toString('hex'),
        ];
      })
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

test('repeated staging includes only the current allowlist and preserves source packets', (t) => {
  const { root, write } = fixture(t);
  const before = snapshot(resolve(root, 'data'));
  const output = stageLocalEvidenceAssets(root, version);
  write('.local/local-dashboard-assets/data/evidence/v1.0.0/obsolete.json', 'stale');
  write(`.local/local-dashboard-assets/data/evidence/v${version}/unlisted.json`, 'stale');
  write('.local/local-dashboard-assets/obsolete.txt', 'stale');

  assert.equal(stageLocalEvidenceAssets(root, version), output);
  assert.deepEqual(
    Object.keys(snapshot(output)),
    [
      'THIRD-PARTY-NOTICES.txt',
      `data/evidence/v${version}/${artifact}`,
      `data/evidence/v${version}/manifest.json`,
      'evidence-index.json',
      'favicon.png',
      'guide-preview.png',
      'proof-demo.vtt',
      'proof-demo.webm',
    ].sort((a, b) => a.localeCompare(b)),
  );
  assert.equal(
    readFileSync(resolve(output, `data/evidence/v${version}/${artifact}`), 'utf8'),
    readFileSync(resolve(root, `data/evidence/v${version}/${artifact}`), 'utf8'),
  );
  assert.deepEqual(snapshot(resolve(root, 'data')), before);
});

test('a mismatched artifact hash fails staging', (t) => {
  const { root, write } = fixture(t);
  write(`data/evidence/v${version}/${artifact}`, 'tampered');
  assert.throws(() => stageLocalEvidenceAssets(root, version), /Evidence hash mismatch/);
});

test('traversal artifact names fail without altering source files', (t) => {
  const { root, manifest, saveManifest } = fixture(t);
  manifest.artifacts['../outside.json'] = manifest.artifacts[artifact];
  saveManifest();
  const before = snapshot(resolve(root, 'data'));
  assert.throws(() => stageLocalEvidenceAssets(root, version), /Unsafe evidence filename/);
  assert.deepEqual(snapshot(resolve(root, 'data')), before);
});

test('an evidence version mismatch fails staging', (t) => {
  const { root, manifest, saveManifest } = fixture(t);
  manifest.engine_version = '1.0.0';
  saveManifest();
  assert.throws(() => stageLocalEvidenceAssets(root, version), /Evidence version mismatch/);
});

test('missing required media fails staging', (t) => {
  const { root } = fixture(t);
  rmSync(resolve(root, media[0]));
  assert.throws(() => stageLocalEvidenceAssets(root, version), /ENOENT/);
});

for (const linkPath of ['.local', '.local/local-dashboard-assets']) {
  test(`refuses linked staging directory ${linkPath} without changing its target`, (t) => {
    const { root } = fixture(t);
    const outside = mkdtempSync(resolve(tmpdir(), 'twin-outside-'));
    t.after(() => rmSync(outside, { recursive: true, force: true }));
    writeFileSync(resolve(outside, 'preserve.txt'), 'preserve');
    mkdirSync(dirname(resolve(root, linkPath)), { recursive: true });
    symlinkSync(outside, resolve(root, linkPath), 'junction');
    assert.throws(() => stageLocalEvidenceAssets(root, version), /Unsafe staging directory/);
    assert.equal(readFileSync(resolve(outside, 'preserve.txt'), 'utf8'), 'preserve');
    assert.equal(existsSync(resolve(outside, 'data')), false);
  });
}
