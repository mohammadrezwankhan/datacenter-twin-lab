import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('../../', import.meta.url)) });
const projectRequire = createRequire(import.meta.url);
const eslintRequire = createRequire(projectRequire.resolve('eslint'));
const configRequire = createRequire(eslintRequire.resolve('@eslint/config-array'));
const typescriptRequire = createRequire(projectRequire.resolve('typescript-eslint'));
const parserRequire = createRequire(typescriptRequire.resolve('@typescript-eslint/parser'));
const estreeRequire = createRequire(parserRequire.resolve('@typescript-eslint/typescript-estree'));
const matchers = [
  ['ESLint', eslintRequire('minimatch')],
  ['config-array', configRequire('minimatch')],
  ['typescript-estree', estreeRequire('minimatch')],
];

test('generated Playwright outputs stay outside authored-source lint', async () => {
  for (const directory of [
    'test-results',
    'test-results-root',
    'playwright-report',
    'playwright-report-demo',
    'playwright-report-root',
  ]) {
    const generated = `apps/web/${directory}/journey/assets/generated.js`;
    assert.equal(await eslint.isPathIgnored(generated), true, generated);
  }
});

test('authored application, tests and quality tooling remain linted', async () => {
  for (const maintained of [
    'apps/web/src/GuidedStart.tsx',
    'apps/web/tests-demo/guided-start.spec.ts',
    'apps/web/tests-engine/runtime-progress.test.ts',
    'tests/browser/csp.test.mjs',
    'scripts/browser-csp.mjs',
    'eslint.config.mjs',
  ]) {
    assert.equal(await eslint.isPathIgnored(maintained), false, maintained);
  }
});

test('every tooling matcher respects an explicit globstar expansion budget', () => {
  // Three splits expand to only eight rows in the vulnerable version: no large DoS input.
  const pattern = '**/../a/x/**/../b/x/**/../c/x';
  for (const [consumer, { Minimatch }] of matchers) {
    const matcher = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 4 });
    assert.ok(matcher.globParts.length <= 4, `${consumer} exceeded the expansion budget`);
  }
});

test('tooling matchers preserve authored-file selection and partial directory traversal', () => {
  const cases = [
    ['apps/web/src/GuidedStart.tsx', '**/*.{ts,tsx}', false, true],
    ['apps/web/src/.hidden.ts', '**/*.ts', false, true],
    ['apps/web/src/guide.js', '**/*.{ts,tsx}', false, false],
    ['apps/web/node_modules/example/index.js', '**/node_modules/**', false, true],
    ['apps/web', 'apps/web/src/**/*.tsx', true, true],
    ['campaign', 'apps/web/src/**/*.tsx', true, false],
    ['src/run.test.ts', '!**/*.test.ts', false, false],
    ['src/run.ts', '!**/*.test.ts', false, true],
  ];
  for (const [consumer, { Minimatch }] of matchers) {
    for (const [file, pattern, partial, expected] of cases) {
      assert.equal(
        new Minimatch(pattern, { dot: true }).match(file, partial),
        expected,
        `${consumer}: ${file} / ${pattern}`,
      );
    }
    assert.equal(
      new Minimatch('!**/*.test.ts', { dot: true, flipNegate: true }).match('src/run.test.ts'),
      true,
      consumer,
    );
  }
});

test('trailing separators follow the corrected extglob path contract', () => {
  for (const [consumer, { minimatch }] of matchers) {
    for (const pattern of ['a/b/?(x)', 'a/b/*(x)']) {
      assert.equal(minimatch('a/b/', pattern, { dot: true }), false, `${consumer}: ${pattern}`);
    }
  }
});
