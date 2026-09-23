import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

async function exportedRun(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export run' }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}

async function downloadedComparison(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download comparison JSON' }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}

function nativeRun(scenario: unknown) {
  return JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      [
        '-c',
        'import json,sys;from datacenter_twin.topology import SiteScenario;from datacenter_twin.continuity import simulate_continuity;print(json.dumps(simulate_continuity(SiteScenario.from_dict(json.load(sys.stdin))).to_dict()))',
      ],
      {
        cwd: '../..',
        input: JSON.stringify(scenario),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    ),
  );
}

function nativeSweep(scenario: unknown, parameter: string, values: string[]) {
  return JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      [
        '-c',
        'import json,sys;from datacenter_twin.topology import SiteScenario;from datacenter_twin.sensitivity import sweep_continuity;data=json.load(sys.stdin);print(json.dumps(sweep_continuity(SiteScenario.from_dict(data["scenario"]),data["parameter"],data["values"])))',
      ],
      {
        cwd: '../..',
        input: JSON.stringify({ scenario, parameter, values }),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    ),
  );
}

async function selectedValues(page: Page, unit: string) {
  const values: string[] = [];
  for (let index = 1; index <= 3; index++) {
    const select = page.getByLabel(`Comparison value ${index} (${unit})`);
    if (await select.count()) values.push(await select.inputValue());
  }
  return values;
}

test('battery reserve and generator delay comparisons match complete native Python sweeps', async ({
  page,
}) => {
  await page.goto('./?mode=advanced&preset=normal');
  await expect(page.getByTestId('served-power')).toBeVisible();
  const source = await exportedRun(page);
  const sourceHash = source.input_sha256;

  await page.getByText('Advanced scenario comparison', { exact: true }).click();
  const batteryParameter = page.getByLabel('Comparison assumption');
  await batteryParameter.selectOption('battery_initial_kwh');
  await expect(page.getByLabel('Comparison value 3 (kWh)')).toBeVisible();
  const batteryValues = await selectedValues(page, 'kWh');
  await page.getByRole('button', { name: 'Compare selected values' }).click();
  await expect(page.getByTestId('scenario-comparison')).toContainText(sourceHash);
  const batteryJson = await downloadedComparison(page);
  expect(batteryJson).toEqual(nativeSweep(source.scenario, 'battery_initial_kwh', batteryValues));
  const batteryTable = page.getByTestId('scenario-comparison');
  await expect(batteryTable).toContainText('No event; 0 kWh initial reserve');
  await expect(batteryTable).toContainText('No depletion event');

  await page.goto('./?mode=advanced&preset=utility_loss');
  await expect(page.getByTestId('served-power')).toBeVisible();
  const delaySource = await exportedRun(page);
  await page.getByText('Advanced scenario comparison', { exact: true }).click();
  await page.getByLabel('Comparison assumption').selectOption('generator_start_delay_s');
  await expect(page.getByLabel('Comparison value 3 (s)')).toBeVisible();
  const delayValues = await selectedValues(page, 's');
  await page.getByRole('button', { name: 'Compare selected values' }).click();
  await expect(page.getByTestId('scenario-comparison')).toContainText(delaySource.input_sha256);
  const delayJson = await downloadedComparison(page);
  expect(delayJson).toEqual(
    nativeSweep(delaySource.scenario, 'generator_start_delay_s', delayValues),
  );
  await expect(page.getByText(/A delay can have no effect/)).toBeVisible();
});

test('surviving distribution path capacity changes only the selected path and matches Python', async ({
  page,
}) => {
  await page.goto('./?mode=advanced&preset=path_maintenance');
  await expect(page.getByTestId('served-power')).toBeVisible();
  const source = await exportedRun(page);
  await page.getByText('Advanced scenario comparison', { exact: true }).click();
  await page.getByLabel('Comparison assumption').selectOption('distribution_path_capacity_kw');
  await expect(page.getByLabel('Distribution path to vary')).toHaveValue('path-b');
  await expect(page.getByLabel('Comparison value 3 (kW)')).toBeVisible();
  const values = await selectedValues(page, 'kW');
  await page.getByRole('button', { name: 'Compare selected values' }).click();
  await expect(page.getByTestId('scenario-comparison')).toContainText(source.input_sha256);
  await expect(page.locator('.scenario-comparison__status')).toContainText('Comparison complete');
  const comparison = await downloadedComparison(page);
  expect(comparison.target_asset).toEqual({ id: 'path-b', name: 'Distribution B' });
  expect(comparison.runs.map((entry: { value: string }) => entry.value)).toEqual(values);
  const expected = values.map((value) => {
    const scenario = structuredClone(source.scenario);
    scenario.assets = scenario.assets.map((asset: { id: string; capacity_kw: string }) =>
      asset.id === 'path-b' ? { ...asset, capacity_kw: value } : asset,
    );
    return nativeRun(scenario);
  });
  expect(comparison.runs.map((entry: { result: unknown }) => entry.result)).toEqual(expected);
  for (const entry of comparison.runs) {
    expect(entry.result.scenario.assets).toEqual(
      source.scenario.assets.map((asset: { id: string; capacity_kw: string }) =>
        asset.id === 'path-b' ? { ...asset, capacity_kw: entry.value } : asset,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const tableScroll = page.locator('.scenario-comparison__table-wrap');
  await tableScroll.focus();
  await expect(tableScroll).toBeFocused();
  expect(await tableScroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a comparison clears when its assumptions change or a new run completes', async ({ page }) => {
  await page.goto('./?mode=advanced&preset=utility_loss');
  await expect(page.getByTestId('served-power')).toBeVisible();
  await page.getByText('Advanced scenario comparison', { exact: true }).click();
  const parameter = page.getByLabel('Comparison assumption');
  await parameter.selectOption('battery_initial_kwh');
  await page.getByRole('button', { name: 'Compare selected values' }).click();
  await expect(page.getByTestId('scenario-comparison')).toBeVisible();
  await parameter.selectOption('generator_start_delay_s');
  await expect(page.getByTestId('scenario-comparison')).toHaveCount(0);

  await parameter.selectOption('battery_initial_kwh');
  await page.getByRole('button', { name: 'Compare selected values' }).click();
  await expect(page.getByTestId('scenario-comparison')).toBeVisible();
  await page.getByLabel('Comparison value 1 (kWh)').selectOption({ index: 1 });
  await expect(page.getByTestId('scenario-comparison')).toHaveCount(0);
  await page.getByRole('button', { name: 'Compare selected values' }).click();
  await expect(page.getByTestId('scenario-comparison')).toBeVisible();
  await page.getByLabel('Initial battery (kWh)').fill('50');
  await page.getByRole('button', { name: 'Run scenario' }).click();
  await expect(page.getByTestId('scenario-comparison')).toHaveCount(0);
});
