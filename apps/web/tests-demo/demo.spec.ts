import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

async function exported(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export run' }).click();
  const file = await pending;
  return JSON.parse(await readFile((await file.path())!, 'utf8'));
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

test('all presets match native Python with external network blocked and no API', async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  // Local filtering software can inject requests. Deny all off-origin traffic
  // and prove that calculations still work without external network access.
  await context.route('**/*', (route) =>
    route.request().url().startsWith('http://127.0.0.1:4174/') ? route.continue() : route.abort(),
  );
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('./');
  await expect(page.getByTestId('served-power')).toContainText('1,000');
  for (const preset of [
    'generator_failure',
    'normal',
    'utility_loss',
    'path_maintenance',
    'shared_domain',
  ]) {
    await page.getByLabel('Scenario', { exact: true }).selectOption(preset);
    await expect(page.getByRole('button', { name: 'Run scenario' })).toBeEnabled();
    const run = await exported(page);
    expect(run).toEqual(nativeRun(run.scenario));
    expect(run.summary.energy_balance_residual_kwh).toBe('0');
  }
  expect(requests.filter((url) => url.includes('/api/'))).toEqual([]);
});

test('failure journey changes energy, replays recovery, and exports reports and a sweep', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Battery depleted 607.8 s' })).toBeVisible();
  await page.getByLabel('Initial battery (kWh)').fill('50');
  await page.getByRole('button', { name: 'Run scenario' }).click();
  await expect(page.getByRole('button', { name: 'Battery depleted 478.3 s' })).toBeVisible();
  const run = await exported(page);
  expect(run).toEqual(nativeRun(run.scenario));
  expect(
    run.events.find((event: { action: string }) => event.action === 'battery_depleted').at_s,
  ).toBe('478.2675');
  await page.getByRole('button', { name: 'Battery depleted 478.3 s' }).click();
  await expect(page.getByTestId('served-power')).toHaveText('0 kW');
  await page.getByRole('button', { name: 'Utility recovers 900 s' }).click();
  await expect(page.getByTestId('served-power')).toHaveText('1,000 kW');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download HTML report' }).click();
  const report = await pending;
  expect(await readFile((await report.path())!, 'utf8')).toContain(run.input_sha256);
  await page.getByRole('button', { name: 'Compare battery reserves' }).click();
  await expect(page.getByTestId('battery-sweep')).toContainText('81.167');
  await page.screenshot({ path: 'test-results/browser-demo-desktop.png', fullPage: true });
});

test('archive corruption fails visibly and phone layout stays within the viewport', async ({
  page,
}) => {
  await page.route('**/engine.zip', (route) => route.fulfill({ body: 'corrupted archive' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('integrity check failed');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('phone visitor can run and inspect a scenario without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByTestId('served-power')).toContainText('1,000');
  await page.getByRole('button', { name: 'Battery depleted 607.8 s' }).click();
  await expect(page.getByTestId('served-power')).toHaveText('0 kW');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/browser-demo-phone.png', fullPage: true });
});

test('a visitor without JavaScript can read the example and find the Python route', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4174/datacenter-twin-lab/');
    await expect(
      page.getByRole('heading', { name: 'Datacenter Twin Lab', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('JavaScript is disabled.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Python quickstart' })).toHaveAttribute(
      'href',
      'https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/docs/quickstart.md',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: 'test-results/browser-demo-no-javascript.png', fullPage: true });
  } finally {
    await context.close();
  }
});
