import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { nativeRun } from './course-test-helpers';

async function download(page: Page, name = 'Export run') {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}
async function openEditor(page: Page, preset = 'normal') {
  await page.goto(`./?preset=${preset}`);
  await expect(page.getByTestId('served-power')).toBeVisible();
  await page.getByRole('button', { name: 'Edit demand timeline', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Demand timeline', exact: true })).toBeVisible();
}
async function runEdited(page: Page) {
  await page.getByRole('button', { name: 'Run edited timeline', exact: true }).click();
  await expect(page.locator('.notice')).toContainText('Edited demand timeline calculated');
  return JSON.parse(await download(page));
}

test('visual demand edits preview requested energy, then reproduce native and optional Python reports', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));
  await openEditor(page);
  const previous = await page.getByTestId('run-id').textContent();
  await page.getByRole('button', { name: 'Add demand step', exact: true }).click();
  await expect(page.getByLabel('Selected time (seconds)')).toHaveValue('900');
  await page.getByLabel('Selected demand (kW)').fill('500');
  await expect(page.getByTestId('demand-preview-energy')).toHaveText('375 kWh');
  await expect(page.getByTestId('run-id')).toHaveText(previous!);
  const oldRun = JSON.parse(await download(page));
  expect(oldRun.summary.requested_it_kwh).toBe('500');
  const run = await runEdited(page);
  expect(run.summary.requested_it_kwh).toBe('375');
  expect(run.summary.served_it_kwh).toBe('375');
  expect(run).toEqual(nativeRun(run));
  expect(run.scenario.events).toEqual([
    {
      at_s: 900,
      action: 'set_demand',
      target: oldRun.scenario.assets.find((asset: { kind: string }) => asset.kind === 'load').id,
      value_kw: '500',
    },
  ]);
  for (const format of ['Markdown', 'HTML']) {
    const report = await download(page, `Download ${format} report`);
    expect(report).toContain(run.input_sha256);
    expect(report).toContain('375');
  }
  expect(requests.filter((url) => /pyodide|engine\.zip/.test(url))).toEqual([]);
  expect(requests.filter((url) => !url.startsWith('GET '))).toEqual([]);
  await page.getByLabel('Verify against Python', { exact: true }).check();
  await expect(page.getByTestId('python-verification-status')).toContainText(
    'Exact match with Python',
  );
});

test('all four profile timelines support visual selection, precision, removal and reset without altering a run', async ({
  page,
}) => {
  await openEditor(page, 'ai_cluster_50mw_ramp');
  for (const profile of ['ai_cluster_50mw', 'hyperscale_200mw', 'crypto_30mw', 'traditional_5mw']) {
    await page.getByLabel('Scenario', { exact: true }).selectOption(`${profile}_ramp`);
    await expect(
      page.getByRole('button', { name: 'Run edited timeline', exact: true }),
    ).toBeEnabled();
    const before = JSON.parse(await download(page));
    await expect(
      page.getByRole('group', { name: 'Demand steps in event order' }).getByRole('button'),
    ).toHaveCount(4);
    await page.getByRole('button', { name: 'Select step 1', exact: true }).click();
    await page.getByLabel('Selected demand (kW)').fill('500.000000001');
    await page.getByLabel('Move step (seconds)').fill('301');
    const result = await runEdited(page);
    expect(result).toEqual(nativeRun(result));
    expect(result.scenario.events[0]).toEqual({
      ...before.scenario.events[0],
      at_s: 301,
      value_kw: '500.000000001',
    });
    expect(result.scenario.events.slice(1)).toEqual(before.scenario.events.slice(1));
    await page.getByLabel('Timeline point').selectOption('event-1');
    await page.getByRole('button', { name: 'Remove selected step', exact: true }).click();
    await expect(
      page.getByRole('group', { name: 'Demand steps in event order' }).getByRole('button'),
    ).toHaveCount(3);
    await page.getByRole('button', { name: 'Reset timeline edits', exact: true }).click();
    expect(JSON.parse(await download(page))).toEqual(result);
    await expect(
      page.getByRole('group', { name: 'Demand steps in event order' }).getByRole('button'),
    ).toHaveCount(4);
  }
});

test('invalid fields preserve results and changing the scenario discards the old editor draft', async ({
  page,
}) => {
  await openEditor(page, 'generator_failure');
  const previous = await page.getByTestId('run-id').textContent();
  await page.getByRole('button', { name: 'Add demand step', exact: true }).click();
  for (const time of ['', '-1', '0.5', '1800']) {
    await page.getByLabel('Selected time (seconds)').fill(time);
    await expect(
      page.getByRole('button', { name: 'Run edited timeline', exact: true }),
    ).toBeDisabled();
    await expect(page.getByTestId('run-id')).toHaveText(previous!);
  }
  await page.getByLabel('Selected time (seconds)').fill('300');
  for (const demand of ['', '-1', 'NaN', '1.0000000001']) {
    await page.getByLabel('Selected demand (kW)').fill(demand);
    await expect(
      page.getByRole('button', { name: 'Run edited timeline', exact: true }),
    ).toBeDisabled();
  }
  await page.getByLabel('Selected demand (kW)').fill('500');
  await page.getByLabel('Grid tariff', { exact: true }).fill('');
  await expect(page.getByLabel('Timeline point')).toHaveValue('initial');
  await expect(
    page.getByRole('group', { name: 'Demand steps in event order' }).getByRole('button'),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Add demand step', exact: true }).click();
  await page.getByLabel('Selected time (seconds)').fill('300');
  await page.getByLabel('Selected demand (kW)').fill('500');
  const result = await runEdited(page);
  expect(result).toEqual(nativeRun(result));
  expect(result.summary.grid_energy_charge).toBeNull();
  expect(
    result.scenario.events.filter((event: { action: string }) => event.action !== 'set_demand'),
  ).toHaveLength(4);
  await page.getByRole('button', { name: 'Add demand step', exact: true }).click();
  await page.getByLabel('Scenario', { exact: true }).selectOption('normal');
  await expect(
    page.getByRole('group', { name: 'Demand steps in event order' }).getByRole('button'),
  ).toHaveCount(1);
  await expect(page.getByLabel('Selected demand (kW)')).toHaveValue('1000');
});

test('editor is lazy, keyboard-accessible, responsive and explicit about requested demand', async ({
  page,
}, testInfo) => {
  const resources: string[] = [];
  page.on('request', (request) => resources.push(request.url()));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByTestId('guide-prediction').fill('300');
  await page.getByTestId('guide-run').click();
  await expect(page.getByTestId('guide-result')).toBeVisible();
  expect(resources.filter((url) => /DemandTimeline|contract-/.test(url))).toEqual([]);
  await page.getByRole('button', { name: 'Advanced workspace', exact: true }).click();
  await expect(page.getByTestId('served-power')).toBeVisible();
  expect(resources.filter((url) => /DemandTimeline/.test(url))).toEqual([]);
  await page.getByRole('button', { name: 'Edit demand timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Add demand step', exact: true }).click();
  const slider = page.getByLabel('Move step (seconds)');
  await slider.focus();
  const time = Number(await slider.inputValue());
  await slider.press('ArrowRight');
  await expect(page.getByLabel('Selected time (seconds)')).toHaveValue(String(time + 1));
  await page.getByLabel('Selected demand (kW)').fill('١٠٠٠');
  await expect(
    page.getByRole('img', {
      name: 'Preview of requested IT demand in kilowatts over elapsed seconds',
    }),
  ).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('#demand-timeline').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const audit = await new AxeBuilder({ page })
      .include('#demand-timeline')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page
      .locator('#demand-timeline')
      .screenshot({ path: testInfo.outputPath(`demand-editor-${width}.png`) });
  }
  expect(
    await page
      .locator('.demand-point')
      .evaluateAll((points) =>
        points.every((point) => !point.getAttribute('style')?.includes('NaN')),
      ),
  ).toBe(true);
});
