/** Real browser regressions. Run explicitly with a development Playwright install:
 * BROWSER_AUTOMATION_MODULE=/absolute/path/to/playwright/index.mjs \
 * CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium \
 * node --test tests/browser/production-csp.chromium.mjs
 * The server deliberately sends no CSP header: document policies must enforce it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.BROWSER_AUTOMATION_MODULE || '@playwright/test');
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const mediaRoot = 'assets/engineering-hero/v1/';
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};
async function until(page, predicate) {
  for (let attempt = 0; attempt < 600; attempt++) {
    if (await page.evaluate(predicate)) return;
    await page.waitForTimeout(50);
  }
  throw new Error('Expected browser state was not reached.');
}

for (const pagePath of ['index.html', 'integration/vanilla/example.html']) {
  test(`production hero executes local assets and blocks injection: ${pagePath}`, async () => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url || '/', 'http://local');
      const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!target.startsWith(root + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      readFile(target).then(
        (data) => {
          response.setHeader(
            'Content-Type',
            mime[path.extname(target)] || 'application/octet-stream',
          );
          response.end(data);
        },
        () => response.writeHead(404).end(),
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    const browser = await chromium.launch({
      ...(process.env.CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args:
        process.env.BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
    });
    try {
      const context = await browser.newContext({
        reducedMotion: 'reduce',
        viewport: { width: 1280, height: 900 },
      });
      const external = [],
        errors = [];
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
          external.push(url.href);
          return route.abort();
        }
        return route.continue();
      });
      await context.addInitScript(() => {
        window.__policyEvents = [];
        document.addEventListener('securitypolicyviolation', (event) =>
          window.__policyEvents.push({
            directive: event.effectiveDirective,
            blocked: event.blockedURI,
          }),
        );
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(origin + '/' + mediaRoot + pagePath, { waitUntil: 'networkidle' });
      if (pagePath === 'index.html') {
        await until(page, () => window.__HERO_READY__ === true || window.__HERO_ERROR__ !== null);
        assert.equal(
          await page.evaluate(() => window.__HERO_READY__),
          true,
          'real WebGL/import-map initialization',
        );
      } else {
        await until(page, () =>
          Boolean(document.querySelector('khan-grid-hero')?.shadowRoot?.querySelector('.toggle')),
        );
        const toggle = page.locator('khan-grid-hero').locator('.toggle');
        await toggle.click();
        await until(page, () => document.querySelector('khan-grid-hero')._playing);
        assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(await page.evaluate(() => window.__policyEvents), []);
      await context.setOffline(true);
      assert.ok(await page.locator('h1').innerText());
      await context.setOffline(false);
      await page.evaluate(() => {
        const inline = document.createElement('script');
        inline.textContent = 'window.__injectionExecuted = true';
        document.head.append(inline);
        const remote = document.createElement('script');
        remote.src = 'https://example.invalid/blocked-script.js';
        document.head.append(remote);
        void fetch('https://example.invalid/blocked-fetch').catch(() => {});
      });
      await until(page, () => window.__policyEvents.length >= 3);
      assert.equal(await page.evaluate(() => window.__injectionExecuted), undefined);
      const events = await page.evaluate(() => window.__policyEvents);
      assert.ok(
        events.some((event) => event.directive === 'script-src-elem' && event.blocked === 'inline'),
      );
      assert.ok(
        events.some(
          (event) =>
            event.directive === 'script-src-elem' &&
            event.blocked.startsWith('https://example.invalid/'),
        ),
      );
      assert.ok(events.some((event) => event.directive === 'connect-src'));
      assert.deepEqual(external, [], 'CSP rejects network destinations before requests');
    } finally {
      await browser.close();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}
