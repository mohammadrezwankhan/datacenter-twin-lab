import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { nativeRun } from './course-test-helpers';

async function exportResult(page: import('@playwright/test').Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export guided run (JSON)' }).click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, 'utf8'));
}

test('the five-minute guide requires a prediction and matches native results for both reserves', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: /five minutes to reason it through/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Walkthrough steps' }).getByText('Predict'),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Walkthrough steps' }).getByText('Run'),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Walkthrough steps' }).getByText('Explain'),
  ).toBeVisible();
  await expect(page.getByTestId('guide-result')).toHaveCount(0);

  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/demo?')) requests.push(request.url());
  });
  await page.getByTestId('guide-run').click();
  await expect(page.getByRole('alert')).toContainText('Enter a prediction');
  await expect(page.getByTestId('guide-result')).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.getByTestId('guide-prediction').fill('-1');
  await page.getByTestId('guide-run').click();
  await expect(page.getByRole('alert')).toContainText('0 seconds or more');
  expect(requests).toEqual([]);

  const cases = [
    { reserve: '100', prediction: '300', rideThrough: 307.8, elapsed: 607.8 },
    { reserve: '50', prediction: '150', rideThrough: 153.9, elapsed: 453.9 },
  ];
  for (const [index, item] of cases.entries()) {
    if (index === 1)
      await page.getByRole('button', { name: /50 kWh.*Half-reserve challenge/ }).click();
    await page.getByTestId('guide-prediction').fill(item.prediction);
    await expect(page.getByTestId('guide-result')).toHaveCount(0);
    await page.getByTestId('guide-run').click();
    await expect(page.getByTestId('guide-result')).toBeVisible();
    await expect(page.getByTestId('guide-result')).toContainText(`${item.rideThrough} seconds`);
    await expect(page.getByTestId('guide-result')).toContainText(`${item.elapsed} s elapsed`);
    await expect(page.getByTestId('guide-result')).toContainText('300 s elapsed');

    const result = await exportResult(page);
    expect(result).toEqual(nativeRun(result));
    expect(result.scenario.it_demand_kw).toBe('1000');
    expect(result.scenario.distribution_efficiency).toBe('0.95');
    expect(result.scenario.battery_discharge_efficiency).toBe('0.9');
    expect(result.scenario.battery_initial_kwh).toBe(item.reserve);
    expect(result.scenario.battery_charge_kw).toBe('0');
    expect(result.scenario.events).toContainEqual(
      expect.objectContaining({ at_s: 300, action: 'asset_down', target: 'utility' }),
    );
    expect(result.scenario.events).toContainEqual(
      expect.objectContaining({ at_s: 300, action: 'asset_down', target: 'generator' }),
    );
    expect(result.scenario.events).toContainEqual(
      expect.objectContaining({ at_s: 900, action: 'asset_up', target: 'utility' }),
    );
    const depleted = result.events.find(
      (event: { action: string }) => event.action === 'battery_depleted',
    );
    expect(Number(depleted.at_s) - 300).toBeCloseTo(item.rideThrough, 7);
    expect(Number(depleted.at_s)).toBeCloseTo(item.elapsed, 7);
    expect(result.summary.energy_balance_residual_kwh).toBe('0');
  }
});

test('guide controls are keyboard reachable and fit a 320 px viewport with reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const prediction = page.getByLabel('Your ride-through prediction (seconds from outage)');
  await prediction.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('guide-run')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const transitionSeconds = await page.getByTestId('guide-run').evaluate((button) =>
    getComputedStyle(button)
      .transitionDuration.split(',')
      .map((value) =>
        value.trim().endsWith('ms') ? Number.parseFloat(value) / 1000 : Number.parseFloat(value),
      )
      .every((seconds) => seconds < 0.001),
  );
  expect(transitionSeconds).toBe(true);
  await expect(page.getByTestId('guide-result')).toHaveCount(0);
});
