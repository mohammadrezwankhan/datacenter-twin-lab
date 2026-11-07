import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'parse5';
import {
  appendLocalModuleScript,
  htmlPageTitle,
  inlineMetadataHashes,
  removeSearchMetadata,
  visiblePageText,
} from '../build-html.ts';
import { readRegularFile } from '../read-regular-file.ts';
import { nativeReaderCase } from './native-reader-fixture.ts';
import { workerRequest } from '../src/worker-envelope.ts';

void test('HTML text export follows raw-text parsing and decodes entities once', () => {
  const source =
    '<main><h1>A &amp; B</h1><script data-x=">">ignored</script ><style>ignored</style ><p>Keep &lt;script&gt; as plain text<br>next</p><span class="extra sr-only">omit</span><svg><text>omit</text></svg></main>';
  assert.equal(visiblePageText(source), 'A & B\nKeep <script> as plain text\nnext');
});

void test('metadata removal handles spaced end tags without deleting ordinary scripts', () => {
  const source =
    '<!doctype html><html><head><title>Old</title><meta content=">" name="description"><script type="application/ld+json">{"x":"<script>"}</script ><script src="app.js"></script></head><body><p>Keep</p></body></html>';
  const result = removeSearchMetadata(source);
  assert.equal(
    // Expected literal comparison in Node test; no HTML execution.
    // nosemgrep: javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag
    result,
    '<!doctype html><html><head><script src="app.js"></script></head><body><p>Keep</p></body></html>',
  );
  assert.ok(parse(result));
});

void test('search metadata removal preserves SVG accessibility titles', () => {
  const source =
    '<html><head><title>Page &amp; name</title></head><body><svg role="img" aria-labelledby="chart-title"><title id="chart-title">Accessible chart name</title><circle r="1"/></svg></body></html>';
  assert.equal(
    removeSearchMetadata(source),
    '<html><head></head><body><svg role="img" aria-labelledby="chart-title"><title id="chart-title">Accessible chart name</title><circle r="1"/></svg></body></html>',
  );
  assert.equal(htmlPageTitle(source, 'Fallback'), 'Page & name');
});

void test('document title lookup ignores SVG and body titles', () => {
  const source =
    '<html><head></head><body><svg><title>Chart name</title></svg><title>Body title</title></body></html>';
  assert.equal(htmlPageTitle(source, 'Fallback'), 'Fallback');
  assert.equal(removeSearchMetadata(source), source);
});

void test('CSP generation rejects executable inline scripts with legal HTML end-tag variants', () => {
  for (const close of ['</script>', '</script >', '</ScRiPt\t>']) {
    assert.throws(
      () => inlineMetadataHashes(`<script>globalThis.injected = true;${close}`, 'fixture'),
      /Unexpected inline script/,
    );
  }
  const json = '{"safe":"<not-an-end-tag>"}';
  assert.deepEqual(
    inlineMetadataHashes(`<script TYPE="application/ld+json">${json}</script >`, 'fixture'),
    [`'sha256-${createHash('sha256').update(json).digest('base64')}'`],
  );
  assert.deepEqual(inlineMetadataHashes('<script src="app.js"></script>', 'fixture'), []);
});

void test('only local compiler module paths can be appended to generated pages', () => {
  const source = '<html><head></head><body><main>content</main></body></html>';
  assert.equal(
    appendLocalModuleScript(source, '../assets/learn-test.js'),
    '<html><head></head><body><main>content</main><script type="module" src="../assets/learn-test.js"></script></body></html>',
  );
  for (const path of [
    'https://external.invalid/a.js',
    '../assets/x.js" onload="bad',
    '../assets/../../x.js',
    '../assets/x.js?remote=1',
  ]) {
    assert.throws(() => appendLocalModuleScript(source, path), /Invalid local module/);
  }
});

void test('regular-file reads reject symlink and directory substitution', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'twin-regular-file-'));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const file = join(root, 'source');
  writeFileSync(file, 'exact content');
  assert.equal(readRegularFile(file).toString(), 'exact content');
  mkdirSync(join(root, 'directory'));
  assert.throws(() => readRegularFile(join(root, 'directory')), /regular file/);
  symlinkSync(file, join(root, 'linked'));
  assert.throws(() => readRegularFile(join(root, 'linked')));
  assert.throws(() => readRegularFile(join(root, 'missing')), /ENOENT/);
  assert.throws(() => readRegularFile(join(root, 'missing')), { code: 'ENOENT' });
});

void test('regular-file reads reject symlinks through the native platform helper', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'twin-portable-file-'));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const file = join(root, 'source');
  writeFileSync(file, 'portable content');
  assert.equal(readRegularFile(file).toString(), 'portable content');
  symlinkSync(file, join(root, 'linked'));
  assert.throws(() => readRegularFile(join(root, 'linked')), /regular file/);
});

void test('regular-file reads reject changed file identity and close the descriptor', (t) => {
  // The native helper owns acquisition now. This real-filesystem regression
  // retains identity rejection, zero content reads, and EBADF after cleanup.
  nativeReaderCase('test_replacement_before_open_and_descriptor_closure', t);
});

void test('worker request envelopes reject malformed or oversized payloads', () => {
  const valid = { id: 1, path: '/simulations', body: '{}' };
  assert.deepEqual(workerRequest(valid), valid);
  for (const value of [
    null,
    [],
    1,
    {},
    { ...valid, id: NaN },
    { ...valid, id: -1 },
    { ...valid, id: 0.5 },
    { ...valid, path: '' },
    { ...valid, body: {} },
    { ...valid, extra: true },
    { ...valid, body: 'x'.repeat(4 * 1024 * 1024 + 1) },
  ]) {
    assert.equal(workerRequest(value), undefined);
  }
});
