import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

declare global {
  interface Window {
    __productionPolicyEvents?: { directive: string; blocked: string }[];
    __productionInjectionExecuted?: boolean;
  }
}

test('production policy preserves worker computation and offline JSON export while blocking injection', async ({
  page,
  context,
}) => {
  const externalRequests: string[] = [];
  await page.addInitScript(() => {
    window.__productionPolicyEvents = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__productionPolicyEvents?.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
      });
    });
  });
  // Playwright may emit request events for CSP-denied requests. Routing observes
  // attempts that actually reach the network boundary.
  await context.route('https://example.invalid/**', (route) => {
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto('./');
  await expect(page.locator('head > meta').first()).toHaveAttribute(
    'http-equiv',
    'Content-Security-Policy',
  );
  await page.getByTestId('guide-prediction').fill('300');
  await page.getByTestId('guide-run').click();
  await expect(page.getByTestId('guide-result')).toContainText('307.8 seconds');
  expect(await page.evaluate(() => window.__productionPolicyEvents)).toEqual([]);
  await context.setOffline(true);
  await page.getByRole('button', { name: /50 kWh.*Half-reserve challenge/ }).click();
  await page.getByTestId('guide-prediction').fill('150');
  await page.getByTestId('guide-run').click();
  await expect(page.getByTestId('guide-result')).toContainText('153.9 seconds');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export guided run (JSON)' }).click();
  const download = await downloading;
  const file = await download.path();
  expect(file).toBeTruthy();
  if (!file) throw new Error('Export file was not produced');
  const payload: unknown = JSON.parse(await readFile(file, 'utf8'));
  expect(payload).toMatchObject({ schema_version: 2, scenario: { battery_initial_kwh: '50' } });
  await context.setOffline(false);
  await page.evaluate(() => {
    const inline = document.createElement('script');
    inline.textContent = 'window.__productionInjectionExecuted = true';
    document.head.append(inline);
    const remote = document.createElement('script');
    remote.src = 'https://example.invalid/blocked-script.js';
    document.head.append(remote);
    void fetch('https://example.invalid/blocked-fetch').catch(() => {});
  });
  await expect
    .poll(() => page.evaluate(() => window.__productionPolicyEvents?.length))
    .toBeGreaterThanOrEqual(3);
  expect(await page.evaluate(() => window.__productionInjectionExecuted)).toBeUndefined();
  expect(await page.evaluate(() => window.__productionPolicyEvents)).toEqual(
    expect.arrayContaining([
      { directive: 'script-src-elem', blocked: 'inline' },
      { directive: 'script-src-elem', blocked: 'https://example.invalid/blocked-script.js' },
      { directive: 'connect-src', blocked: 'https://example.invalid/blocked-fetch' },
    ]),
  );
  expect(externalRequests).toEqual([]);
});

test('production policy retains the optional local Python worker and WebAssembly verification', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto('./');
  await page.getByTestId('guide-prediction').fill('300');
  await page.getByTestId('guide-run').click();
  await expect(page.getByTestId('guide-result')).toContainText('307.8 seconds');
  await page.getByRole('checkbox', { name: 'Verify against Python' }).check();
  await expect(page.getByText('Exact match with Python:', { exact: false })).toBeVisible({
    timeout: 150000,
  });
});
