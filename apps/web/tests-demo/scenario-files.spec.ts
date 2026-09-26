import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { nativeRun } from './course-test-helpers';

async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function choose(page: Page, data: unknown, name = 'scenario.json') {
  await page.getByLabel('Scenario JSON file (up to 10 MiB)').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)),
  });
}

async function openFiles(page: Page) {
  await page.goto('./?preset=generator_failure');
  await expect(page.getByTestId('served-power')).toBeVisible();
  await page.getByRole('button', { name: 'Import scenario', exact: true }).click();
  return page.getByRole('region', { name: 'Scenario files', exact: true });
}

async function runImported(page: Page) {
  await page.getByRole('button', { name: 'Run imported scenario', exact: true }).click();
  await expect(page.getByTestId('scenario-file-preview')).toHaveCount(0);
  await expect(page.getByLabel('Scenario', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Run scenario', exact: true })).toBeEnabled();
  return download(page, 'Export run');
}

test('all eighteen saved scenarios preview without execution and reproduce native Python', async ({
  page,
}) => {
  test.setTimeout(180000);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') requests.push(request.url());
  });
  await openFiles(page);
  const data = JSON.parse(
    await readFile('../../.local/browser-demo-assets/demo-data.json', 'utf8'),
  );
  expect(Object.keys(data.scenarios)).toHaveLength(18);
  for (const [id, scenario] of Object.entries(data.scenarios)) {
    const previous = await page.getByTestId('run-id').textContent();
    await choose(page, scenario, `${id}.json`);
    await expect(page.getByTestId('scenario-file-preview')).toContainText('Ready to run');
    await expect(page.getByTestId('run-id')).toHaveText(previous!);
    const run = await runImported(page);
    expect(run).toEqual(nativeRun(run));
    expect(run.scenario.id).toBe((scenario as { id: string }).id);
    expect(await download(page, 'Download current scenario')).toEqual(run.scenario);
    expect(new URL(page.url()).searchParams.has('preset')).toBe(false);
  }
  expect(requests, 'Static import must not upload scenario data').toEqual([]);
});

test('run imports ignore supplied results, preserve custom topology and verify with optional Python', async ({
  page,
}) => {
  await openFiles(page);
  const original = await download(page, 'Export run');
  const scenario = structuredClone(original.scenario);
  scenario.name = 'Saved 50 kWh experiment';
  scenario.id = 'saved-half-reserve';
  scenario.battery_initial_kwh = '50';
  scenario.battery_charge_kw = '0';
  scenario.currency = 'EUR';
  scenario.tariff_per_kwh = null;
  scenario.source_ids = ['LOCAL-EXERCISE-001'];
  // Asset identifiers need not match the built-in fixtures.
  const rename = (id: string) => `custom-${id}`;
  scenario.assets.forEach((asset: { id: string }) => {
    asset.id = rename(asset.id);
  });
  scenario.dependencies.forEach((edge: { source: string; target: string }) => {
    edge.source = rename(edge.source);
    edge.target = rename(edge.target);
  });
  scenario.events.forEach((event: { target: string }) => {
    event.target = rename(event.target);
  });
  await choose(
    page,
    {
      ...original,
      scenario,
      run_id: 'untrusted-old-run',
      input_sha256: 'not-a-verified-hash',
      intervals: [],
      summary: { unserved_it_kwh: '999999' },
    },
    'saved-run.json',
  );
  await expect(page.getByTestId('scenario-file-preview')).toContainText(
    'Only the saved inputs are imported',
  );
  const run = await runImported(page);
  expect(run).toEqual(nativeRun(run));
  expect(run.scenario).toEqual(scenario);
  expect(
    run.events.find((event: { action: string }) => event.action === 'battery_depleted').at_s,
  ).toBe('453.9');
  expect(run.summary.grid_energy_charge).toBeNull();
  await page.getByLabel('Verify against Python').check();
  await expect(page.getByTestId('python-verification-status')).toContainText(
    'Exact match with Python',
  );
  await page.getByRole('button', { name: 'Power topology', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Electrical supply topology' })).toBeVisible();
});

test('a native CLI export reopens with its complete result and hashes preserved', async ({
  page,
}) => {
  await openFiles(page);
  const envelope = JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      ['-m', 'datacenter_twin', 'simulate', '--preset', 'path_maintenance'],
      { cwd: '../..', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    ),
  );
  expect(envelope.generated_at_utc).toBeTruthy();
  await choose(page, envelope, 'cli-run.json');
  const result = await runImported(page);
  expect(result).toEqual(envelope.result);
  expect(result.summary.peak_unserved_kw).toBe('335');
});

test('invalid or oversized files leave the completed result and draft untouched', async ({
  page,
}) => {
  const panel = await openFiles(page);
  const original = await download(page, 'Export run');
  const scenario = original.scenario;
  const cycle = structuredClone(scenario);
  cycle.dependencies.push({ source: 'path-a', target: 'main-bus', relation: 'feeds' });
  const unknownTarget = structuredClone(scenario);
  unknownTarget.events[0].target = 'missing-asset';
  const cases: { file: unknown; error: string }[] = [
    { file: '{broken', error: 'not valid JSON' },
    { file: 'null', error: 'scenario object' },
    { file: { schema_version: 1 }, error: 'PUE planning uses a different model' },
    { file: { ...scenario, secret_extra: 'no' }, error: 'unknown fields' },
    { file: { ...scenario, battery_initial_kwh: '-1' }, error: 'battery_initial_kwh' },
    { file: { ...scenario, step_s: 0 }, error: 'step_s' },
    { file: { ...scenario, duration_s: 86400, step_s: 1 }, error: '2000 regular intervals' },
    { file: { ...scenario, distribution_efficiency: 'NaN' }, error: 'distribution_efficiency' },
    { file: unknownTarget, error: 'unknown asset' },
    { file: cycle, error: 'cycle' },
  ];
  for (const item of cases) {
    await choose(page, item.file);
    await expect(panel.getByRole('alert')).toContainText(item.error, { ignoreCase: true });
    await expect(page.getByTestId('scenario-file-preview')).toHaveCount(0);
    expect(await download(page, 'Export run')).toEqual(original);
    await expect(page.getByLabel('Initial battery (kWh)')).toHaveValue(
      scenario.battery_initial_kwh,
    );
  }
  await page.getByLabel('Scenario JSON file (up to 10 MiB)').setInputFiles({
    name: 'too-large.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 32),
  });
  await expect(panel.getByRole('alert')).toContainText('at most 10 MiB');
  expect(await download(page, 'Export run')).toEqual(original);
});

test('preview is keyboard accessible, shows assumptions and discards without losing work', async ({
  page,
}, testInfo) => {
  const panel = await openFiles(page);
  const original = await download(page, 'Export run');
  await page.getByLabel('Initial battery (kWh)').fill('80');
  const scenario = {
    ...original.scenario,
    battery_initial_kwh: '50',
    battery_charge_kw: '0',
    tariff_per_kwh: null,
  };
  await choose(page, scenario);
  const table = panel.getByRole('table');
  await expect(table.getByRole('row', { name: /Opening battery energy/ })).toContainText('80');
  await expect(table.getByRole('row', { name: /Opening battery energy/ })).toContainText('50');
  await expect(table.getByRole('row', { name: /Grid tariff/ })).toContainText('Unknown');
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page })
    .include('#scenario-files')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1080 });
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('scenario-import-preview.png') });
  const discard = page.getByRole('button', { name: 'Discard import', exact: true });
  await discard.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('scenario-file-preview')).toHaveCount(0);
  await expect(page.getByLabel('Initial battery (kWh)')).toHaveValue('80');
  expect(await download(page, 'Export run')).toEqual(original);
  expect((await download(page, 'Download current scenario')).battery_initial_kwh).toBe('80');
});

test('a late file read cannot resurrect an import after the draft changes', async ({ page }) => {
  await page.addInitScript(() => {
    const read = File.prototype.text;
    File.prototype.text = function () {
      if (this.name !== 'delayed.json') return read.call(this);
      return new Promise<string>((resolve) => {
        (window as unknown as { finishRead: () => void }).finishRead = () => {
          void read.call(this).then(resolve);
        };
      });
    };
  });
  const panel = await openFiles(page);
  const original = await download(page, 'Export run');
  await choose(page, original.scenario, 'delayed.json');
  await expect(panel.getByRole('status')).toContainText('Reading and validating');
  await page.getByLabel('Initial battery (kWh)').fill('70');
  await page.evaluate(() => (window as unknown as { finishRead: () => void }).finishRead());
  await expect(panel.getByRole('status')).toHaveCount(0);
  await expect(page.getByTestId('scenario-file-preview')).toHaveCount(0);
  await choose(page, { ...original.scenario, battery_initial_kwh: '30' });
  await expect(page.getByTestId('scenario-file-preview')).toContainText('Ready to run');
  await expect(page.getByLabel('Initial battery (kWh)')).toHaveValue('70');
});
