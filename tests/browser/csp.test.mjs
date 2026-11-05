import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  browserPolicy,
  checkDocuments,
  withBrowserPolicy,
  policyIssues,
} from '../../scripts/browser-csp.mjs';

test('public documents have exact CSP hashes and no inline attribute execution', async () => {
  const result = await checkDocuments(fileURLToPath(new URL('../../', import.meta.url)));
  assert.ok(result.files > 0);
  assert.deepEqual(result.failures, []);
});
test('CSP hashes change when executable content changes, preserving local fetch', () => {
  const before = withBrowserPolicy(
    '<!doctype html><head><style>p{color:red}</style></head><script>const n=1;</script>',
  );
  assert.deepEqual(policyIssues(before), []);
  const changed = before.replace('const n=1', 'const n=2');
  assert.equal(policyIssues(changed).length, 1);
  const after = withBrowserPolicy(changed);
  assert.deepEqual(policyIssues(after), []);
  assert.match(after, /connect-src 'self'/);
  assert.doesNotMatch(after, /unsafe-inline|unsafe-eval/);
  assert.equal(withBrowserPolicy(after), after);
});
test('document fragments inherit CSP without a synthetic head', () => {
  const fragment = '<section><p>Lesson content</p></section>';
  assert.equal(withBrowserPolicy(fragment), fragment);
  assert.deepEqual(policyIssues(fragment), []);
});
test('a missing document tree fails the required policy gate', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'csp-empty-'));
  try {
    await assert.rejects(checkDocuments(root), /No HTML documents/);
  } finally {
    await rm(root, { recursive: true });
  }
});

test('complete documents with omitted heads fail closed', () => {
  for (const html of [
    '<!doctype html><html><body><script>globalThis.reviewFixture = 1;</script></body></html>',
    '<!doctype html><p>Document with an implicit head</p>',
    '<html><body>Document</body></html>',
    '<body>Document</body>',
    '<!DOCTYPE HTML>\n<!-- <head> is only comment text -->\n<body>Document</body>',
  ]) {
    assert.ok(policyIssues(html).length > 0, html);
    assert.throws(() => withBrowserPolicy(html), /explicit.*<head>/i, html);
  }
});

test('a policy after script execution fails even when its inline hashes match', () => {
  const script = '<script>globalThis.reviewFixture = 1;</script>';
  const html =
    '<!doctype html><html><head>' +
    script +
    '<meta http-equiv="Content-Security-Policy" content="' +
    browserPolicy(script) +
    '"></head><body></body></html>';
  assert.ok(policyIssues(html).some((issue) => /first|before/i.test(issue)));
  assert.throws(() => withBrowserPolicy(html), /first|before/i);
});

test('policy placement precedes resource content and every other head element', () => {
  for (const content of [
    '<script src="app.js"></script>',
    '<style>body { background-image: url(image.png); }</style>',
    '<link rel="stylesheet" href="style.css">',
    '<link rel="preload" href="app.js" as="script">',
    '<meta http-equiv="refresh" content="0;url=next.html">',
    '<base href="https://outside.invalid/">',
    '<img src="image.png">',
    '<iframe src="frame.html"></iframe>',
    '<body>',
    '<meta charset="utf-8">',
  ]) {
    const html =
      '<!doctype html><html><head>' +
      content +
      '<meta http-equiv="Content-Security-Policy" content="' +
      browserPolicy(content) +
      '"></head><body></body></html>';
    assert.ok(policyIssues(html).length > 0, content);
    assert.throws(() => withBrowserPolicy(html), /first|before/i, content);
  }
});

test('executable or resource content cannot precede the explicit head', () => {
  for (const content of [
    '<script>globalThis.reviewFixture = 1;</script>',
    '<link rel="stylesheet" href="style.css">',
    '<img src="image.png">',
    '<body>',
    'Text that makes the browser open a body',
  ]) {
    const html =
      '<!doctype html><html>' +
      content +
      '<head>' +
      '<meta http-equiv="Content-Security-Policy" content="' +
      browserPolicy(content) +
      '"></head><body></body></html>';
    assert.ok(policyIssues(html).length > 0, content);
    assert.throws(() => withBrowserPolicy(html), /explicit.*<head>/i, content);
  }
});

test('CSP-like text inside comments and inert containers is not an early policy', () => {
  const meta = '<meta http-equiv="Content-Security-Policy" content="' + browserPolicy('') + '">';
  for (const content of [
    '<!--' + meta + '-->',
    '<template>' + meta + '</template>',
    '<noscript>' + meta + '</noscript>',
    '</head><body>' + meta,
  ]) {
    const html = '<!doctype html><html><head>' + content + '</head><body></body></html>';
    assert.ok(policyIssues(html).length > 0, content);
    assert.throws(() => withBrowserPolicy(html), /first|before/i, content);
  }
});

test('ambiguous prolog markup and root resource attributes fail closed', () => {
  for (const prolog of [
    '<!-- misleading --!><script>globalThis.reviewFixture = 1;</script>',
    '<html manifest="cache.appcache">',
    '<html style="background-image:url(image.png)">',
    '<html onload="globalThis.reviewFixture = 1">',
    '<html data-note\'="><script>globalThis.reviewFixture = 1;</script>',
  ]) {
    const html = '<!doctype html>' + prolog + '<head></head><body></body></html>';
    assert.ok(policyIssues(html).length > 0, prolog);
    assert.throws(() => withBrowserPolicy(html), /before|explicit.*<head>/i, prolog);
  }
});

test('a missing policy is inserted before the first head element', () => {
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<script src="app.js"></script></head><body><img src="image.png"></body></html>';
  const after = withBrowserPolicy(html);
  assert.match(after, /<head>\n<meta http-equiv="Content-Security-Policy"/);
  assert.deepEqual(policyIssues(after), []);
  // Architectural exception: this assertion compares fixed trusted HTML strings.
  // node:assert performs no DOM insertion, script execution, or evaluation.
  // nosemgrep: javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag
  assert.equal(after.replace(/\n<meta http-equiv="Content-Security-Policy"[^>]*>/, ''), html);
});

test('early policies preserve bytes with safe root attributes and inert whitespace', () => {
  const html =
    '\ufeff<!doctype html>\n<!-- document comment -->\n' +
    '<html lang="en" data-note="literal > text"><head data-view="main">' +
    '<script>const n = 1;</script></head><body></body></html>';
  const after = withBrowserPolicy(html);
  const withComment = after.replace(
    '<meta http-equiv=',
    '<!-- policy comment -->\n<meta http-equiv=',
  );
  assert.deepEqual(policyIssues(after), []);
  assert.deepEqual(policyIssues(withComment), []);
  assert.equal(withBrowserPolicy(after), after);
  assert.equal(withBrowserPolicy(withComment), withComment);
});

test('raw script and style opening attributes remain visible to the policy gate', () => {
  for (const content of [
    '<script onload="blocked()">const template = "<button onclick=blocked()>";</script>',
    '<style onload="blocked()">p { color: red; }</style>',
    '<script data-note="literal > text" onload="blocked()">const value = 1;</script>',
  ]) {
    const html = withBrowserPolicy('<!doctype html><head>' + content + '</head><body></body>');
    assert.ok(
      policyIssues(html).some((issue) => issue.startsWith('Inline event/style attribute:')),
    );
  }
});

test('raw element markers inside comments cannot hide later executable attributes', () => {
  for (const kind of ['script', 'style']) {
    const content =
      '<!-- <' +
      kind +
      '> -->' +
      '<button onclick="blocked()">Visible button</button>' +
      '<' +
      kind +
      '>plain raw text</' +
      kind +
      '>';
    const html = withBrowserPolicy('<!doctype html><head></head><body>' + content + '</body>');
    assert.ok(policyIssues(html).some((issue) => issue.includes('<button onclick=')));
  }
});

test('nested-looking raw text is skipped without rewriting the surrounding markup', () => {
  const html = withBrowserPolicy(
    '<!doctype html><head>' +
      '<script>const template = "<script onload=blocked()><style style=blocked()>";</script>' +
      '<style>p::before { content: "<button onclick=blocked()>"; }</style>' +
      '</head><body><p>Ordinary content</p></body>',
  );
  assert.deepEqual(policyIssues(html), []);
  assert.equal(withBrowserPolicy(html), html);
});

test('unclosed raw text elements fail the policy inspection', () => {
  for (const tag of ['script', 'style']) {
    const html = withBrowserPolicy('<!doctype html><head></head><body><' + tag + '>plain text');
    assert.ok(policyIssues(html).some((issue) => issue.includes('Unclosed raw text element')));
  }
});

test('raw element markers in text-only elements cannot hide later executable attributes', () => {
  for (const tag of ['title', 'textarea', 'iframe', 'xmp']) {
    const html = withBrowserPolicy(
      '<!doctype html><head></head><body><' +
        tag +
        '><script>inert text</' +
        tag +
        '>' +
        '<button onclick="blocked()">Visible button</button><script>const value = 1;</script></body>',
    );
    assert.ok(policyIssues(html).some((issue) => issue.includes('<button onclick=')));
  }
});
