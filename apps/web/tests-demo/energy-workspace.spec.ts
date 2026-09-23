import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { facilityProfiles, scenarioModes } from '../src/facility-profiles';

async function exportRun(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export run' }).click();
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

test('all facility and pressure selections export native-equal runs', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('./?mode=advanced');
  for (const profile of facilityProfiles) {
    await page.getByRole('button', { name: `${profile.name} profile`, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Run scenario' })).toBeEnabled();
    for (const mode of scenarioModes) {
      await page
        .getByRole('button', { name: mode.name, exact: false })
        .filter({ hasText: mode.name })
        .first()
        .click();
      await expect(page.getByLabel('Scenario', { exact: true })).toHaveValue(
        profile.presets[mode.id],
      );
      await expect(page.getByRole('button', { name: 'Run scenario' })).toBeEnabled();
      const result = await exportRun(page);
      expect(result).toEqual(nativeRun(result.scenario));
      expect(result.scenario.it_demand_kw).toBe(String(profile.loadMw * 1000));
      expect(result.summary.energy_balance_residual_kwh).toBe('0');
      if (mode.id === 'reserve') expect(result.summary.unserved_it_kwh).toBe('0');
    }
  }
  await page.getByLabel('Verify against Python').check();
  await expect(page.getByTestId('python-verification-status')).toContainText(
    'Exact match with Python',
  );
});

test('half reserve and equipment edits produce new results with unchanged exported assumptions', async ({
  page,
}) => {
  await page.goto('./?preset=ai_cluster_50mw_reserve');
  await expect(page.getByTestId('served-power')).toHaveText('50,000 kW');
  await page.getByLabel('Initial battery (kWh)').fill('100000');
  await page.getByRole('button', { name: 'Run scenario' }).click();
  await expect(page.getByRole('button', { name: 'Battery depleted 6,456 s' })).toBeVisible();
  let result = await exportRun(page);
  expect(Number(result.summary.unserved_it_kwh)).toBe(64500);
  expect(result).toEqual(nativeRun(result.scenario));
  await page.getByText('Configure storage, losses & asset limits', { exact: false }).click();
  await page.getByLabel('UPS battery capacity (kW)', { exact: true }).fill('40000');
  await page.getByRole('button', { name: 'Run scenario' }).click();
  await expect(page.getByRole('button', { name: 'Run scenario' })).toBeEnabled();
  result = await exportRun(page);
  expect(
    result.scenario.assets.find((asset: { id: string }) => asset.id === 'battery').capacity_kw,
  ).toBe('40000');
  expect(
    Number(result.intervals.find((row: { start_s: string }) => row.start_s === '300').served_it_kw),
  ).toBe(38000);
  expect(result).toEqual(nativeRun(result.scenario));
  await page.getByLabel('Battery energy capacity (kWh)', { exact: true }).fill('1');
  const id = await page.getByTestId('run-id').innerText();
  await page.getByRole('button', { name: 'Run scenario' }).click();
  expect(
    await page
      .getByLabel('Initial battery (kWh)')
      .evaluate((element: HTMLInputElement) => element.validity.rangeOverflow),
  ).toBe(true);
  await expect(page.getByTestId('run-id')).toHaveText(id);
});

test('energy guide links to an experiment in the selected profile', async ({ page }) => {
  await page.goto('./?preset=hyperscale_200mw_outage');
  await expect(page.getByTestId('served-power')).toHaveText('200,000 kW');
  await page.getByRole('button', { name: 'Energy systems', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The energy systems playbook' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore a load step' }).click();
  await expect(page.getByLabel('Scenario', { exact: true })).toHaveValue('hyperscale_200mw_ramp');
  await page.getByRole('button', { name: 'Demand step 2 600 s' }).click();
  await expect(page.getByTestId('served-power')).toHaveText('220,000 kW');
});

test('scene is visible and keyboard operable at desktop, tablet and phone widths', async ({
  page,
}, testInfo) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto('./?mode=advanced');
    await expect(page.getByTestId('served-power')).toHaveText('50,000 kW');
    const scene = page.getByRole('region', { name: 'Power flow scene' });
    await expect(scene.locator('svg')).toBeVisible();
    await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume animation' })).toBeVisible();
    const battery = scene.getByRole('button', { name: /^UPS battery,/ });
    await battery.focus();
    await battery.press('Enter');
    await expect(scene.getByRole('heading', { name: 'UPS battery', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`workspace-${width}.png`), fullPage: true });
  }
});

test('reduced motion is honored and the opening screen has no runtime errors', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?mode=advanced');
  await expect(page.getByTestId('served-power')).toHaveText('50,000 kW');
  await expect(page.getByRole('button', { name: 'Resume animation' })).toBeVisible();
  expect(
    await page
      .locator('.power-scene')
      .evaluate(
        (element) =>
          Array.from(element.querySelectorAll('*')).filter(
            (node) => getComputedStyle(node).animationName !== 'none',
          ).length,
      ),
  ).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('energy-workspace-desktop.png') });
  expect(errors).toEqual([]);
});
