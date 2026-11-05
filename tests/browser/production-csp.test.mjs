import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Full production documents need an early policy even on hosts that do not
// interpret a provider-specific _headers file. Runtime enforcement is exercised
// by the Chromium production-policy regression harness.
const productionPages = [
  'apps/web/index.html',
  'assets/engineering-hero/v1/index.html',
  'assets/engineering-hero/v1/integration/vanilla/example.html',
];
for (const file of productionPages) {
  test(`production CSP precedes active content: ${file}`, async () => {
    const html = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1];
    assert.ok(head, 'explicit head required');
    const policy =
      /^\s*<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"[^>]*>/i.exec(head)?.[1];
    assert.ok(policy, 'CSP must be the first element inside head');
    const directives = new Map(
      policy
        .split(';')
        .filter(Boolean)
        .map((entry) => {
          const [name, ...values] = entry.trim().split(/\s+/);
          return [name, values];
        }),
    );
    for (const directive of ['default-src', 'script-src', 'style-src', 'connect-src', 'worker-src'])
      assert.ok(directives.has(directive), directive + ' must be explicit');
    assert.deepEqual(directives.get('object-src'), ["'none'"]);
    assert.deepEqual(directives.get('base-uri'), ["'none'"]);
    assert.deepEqual(directives.get('script-src-attr'), ["'none'"]);
    assert.ok(
      !directives
        .get('script-src')
        .some((source) => ["'unsafe-inline'", "'unsafe-eval'", '*', 'https:'].includes(source)),
      'scripts cannot allow arbitrary execution or remote sources',
    );
    assert.ok(
      !directives.get('connect-src').some((source) => /^https?:|^wss?:|^\*$/.test(source)),
      'connections remain local',
    );
  });
}
