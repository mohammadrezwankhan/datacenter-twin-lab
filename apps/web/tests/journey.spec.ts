import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

test('demand changes power, cost, warnings and exported provenance in the same run', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('served-power')).toHaveText('1,000 kW');
  const firstRun = await page.getByTestId('run-id').innerText();
  await page.getByLabel('Scenario', { exact: true }).selectOption('normal');
  await expect(page.getByRole('button', { name: 'Run scenario' })).toBeEnabled();
  await page.getByLabel('IT demand (kW)').fill('1200');
  await expect(page.getByRole('status')).toContainText('Unapplied edits');
  await expect(page.getByTestId('served-power')).toHaveText('1,000 kW');
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/simulations') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Run scenario' }).click();
  const run = await (await response).json();
  await expect(page.getByTestId('served-power')).toHaveText('1,200 kW');
  await expect(page.getByTestId('source-power')).toHaveText('1,263.2 kW');
  await expect(page.getByTestId('grid-cost')).toHaveText('0.35 USD');
  await expect(page.getByTestId('warnings')).toContainText('it envelope exceeded');
  expect(run.scenario.it_demand_kw).toBe('1200');
  await expect(page.getByTestId('run-id')).toHaveText(`RUN ${run.run_id.slice(0, 12)}`);
  expect(await page.getByTestId('run-id').innerText()).not.toBe(firstRun);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export run' }).click();
  const exported = JSON.parse(await fs.readFile((await (await download).path())!, 'utf-8'));
  expect(exported).toEqual(run);
  expect(exported.scenario.source_ids).toContain('DEMO-ELECTRICAL-002');
  expect(errors).toEqual([]);
});

test('failure, depletion, recovery, replay and baseline stay visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('served-power')).toBeVisible();
  await page.getByRole('button', { name: 'Save baseline' }).click();
  await page.getByLabel('Scenario', { exact: true }).selectOption('generator_failure');
  await expect(page.getByTestId('unserved-energy')).not.toHaveText('0 kWh');
  await expect(page.getByRole('heading', { name: 'Demand was not fully served' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Baseline comparison' })).toBeVisible();
  await page.getByRole('button', { name: /battery depleted/ }).click();
  await expect(page.getByTestId('served-power')).toHaveText('0 kW');
  await expect(page.getByTestId('battery-energy')).toHaveText('0 kWh');
  await expect(page.getByTestId('warnings')).toContainText('unserved it load');
  await page.getByRole('button', { name: /asset up.*utility/ }).click();
  await expect(page.getByTestId('served-power')).toHaveText('1,000 kW');
  await page.getByRole('button', { name: 'Play replay' }).click();
  await expect(page.getByRole('button', { name: 'Pause replay' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause replay' }).click();
  await page.getByRole('button', { name: 'Power topology' }).click();
  await page.getByRole('button', { name: /Distribution A:/ }).click();
  await expect(page.getByText('a-room · shared-controls', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Declared relationships' })).toBeVisible();
});

test('evidence links and billing units preserve unknown prices', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('served-power')).toBeVisible();
  await page.getByRole('button', { name: 'Evidence & options' }).click();
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  await expect(page.getByTestId('quote-result')).toContainText('Unknown USD');
  await page.getByLabel('Assumed cloud rate').fill('8');
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  await expect(page.getByTestId('quote-result')).toContainText('8 USD');
  await expect(page.getByTestId('quote-result')).toContainText('provisioned GPU rate: 1 USD/hour');
  await page.getByLabel('Cloud offering').selectOption('oci-h100');
  await expect(page.getByLabel('Assumed cloud rate')).toHaveValue('');
  await expect(page.getByTestId('quote-result')).toHaveCount(0);
  await page.getByLabel('Assumed cloud rate').fill('8');
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  await expect(page.getByTestId('quote-result')).toContainText('64 USD');
  await expect(page.getByTestId('quote-result')).toContainText('8 gpu hour units');
  await page.getByLabel('Cloud offering').selectOption('azure-nd-h100');
  await page.getByRole('button', { name: /Use .* retail snapshot as an assumption/ }).click();
  await expect(page.getByLabel('Assumed cloud rate')).toHaveValue('98.32');
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  await expect(page.getByTestId('quote-result')).toContainText('98.32 USD');
  await expect(page.getByTestId('quote-result')).toContainText('Calculated from your assumption');
  await page.getByRole('link', { name: 'NVIDIA-DGX-H100-20260908 ↗', exact: true }).first().click();
  await expect(page.locator('#source-NVIDIA-DGX-H100-20260908')).toBeInViewport();
  expect(await page.locator('#source-NVIDIA-DGX-H100-20260908 a').getAttribute('href')).toContain(
    'docs.nvidia.com',
  );
});

test('request errors retain the previous run and allow correction', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('served-power')).toBeVisible();
  const oldRun = await page.getByTestId('run-id').innerText();
  await page.getByLabel('Grid tariff').fill('0.0000000001');
  await page.getByRole('button', { name: 'Run scenario' }).click();
  await expect(page.getByRole('alert')).toContainText('nine decimal places');
  await expect(page.getByTestId('run-id')).toHaveText(oldRun);
  await page.getByLabel('Grid tariff').fill('0.2');
  await page.getByRole('button', { name: 'Run scenario' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('grid-cost')).toHaveText('0.58 USD');
});

for (const viewport of [
  { width: 1440, height: 1080 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  test(`responsive layout and keyboard navigation ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByTestId('served-power')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByLabel('Scenario', { exact: true }).selectOption('path_maintenance');
    await expect(page.getByRole('button', { name: 'Run scenario' })).toBeEnabled();
    await page.getByRole('button', { name: /asset down.*path-a/ }).click();
    await expect(page.getByTestId('served-power')).toHaveText('665 kW');
    await page.getByRole('button', { name: 'Evidence & options' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Cloud offering register' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.screenshot({
      path: info.outputPath(`overview-${viewport.width}.png`),
      fullPage: true,
    });
  });
}
