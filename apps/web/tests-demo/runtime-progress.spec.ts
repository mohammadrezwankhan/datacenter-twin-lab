import { expect, test } from '@playwright/test';

test('research runtime stays lazy, exposes file progress, and retries an offline source archive', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('./?study=load-step');

  const studio = page.getByTestId('research-studio');
  await expect(studio).toBeVisible();
  expect(await studio.evaluate((element) => element.tagName)).toBe('SECTION');
  await expect(studio).toHaveAttribute('aria-label', 'Power dynamics research studio');
  await expect(studio.locator('main')).toHaveCount(0);
  expect(requests.some((url) => /pyodide|\.whl|research\.zip/.test(url))).toBe(false);

  await page.route('**/engine.zip', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.route('**/research.zip', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ status: 503, body: 'offline' });
  });
  await page.getByTestId('research-run').click();
  const progress = page.getByTestId('research-runtime-progress');
  await expect(progress).toBeVisible();
  await expect(progress).toContainText('Current file: 0%');
  await expect(progress).toContainText('overall total unknown');
  await expect(page.getByRole('alert')).toContainText('research.zip download failed (503)');
  expect(requests.some((url) => /\/pyodide\/|\.whl/.test(url))).toBe(false);

  await page.unroute('**/research.zip');
  await page.getByTestId('research-run').click();
  await expect(page.getByTestId('research-export-json')).toBeVisible();
  expect(requests.some((url) => /\/pyodide\/.*\.wasm/.test(url))).toBe(true);
});

test('cancelling an in-flight source download clears progress and applies no result', async ({
  page,
}) => {
  await page.goto('./?study=load-step');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/research.zip', async (route) => {
    await gate;
    await route.continue();
  });

  await page.getByTestId('research-run').click();
  const progress = page.getByTestId('research-runtime-progress');
  await expect(progress).toContainText('Downloading research source archive');
  await page.getByTestId('research-cancel').click();
  await expect(progress).toHaveCount(0);
  await expect(page.locator('.research-cancelled-status')).toContainText('Run cancelled');
  await expect(page.getByTestId('research-results')).toContainText('No applied result yet');
  release();
  await page.unroute('**/research.zip');
});
