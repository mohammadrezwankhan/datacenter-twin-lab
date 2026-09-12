import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { lessons } from '../src/course-lessons';

async function exported(page: Page, planning = false) {
  const pending = page.waitForEvent('download');
  await page
    .getByRole('button', { name: planning ? 'Export PUE calculation' : 'Export lesson run' })
    .click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

function nativeRun(run: { schema_version: number; scenario: unknown; assumptions: unknown }) {
  const planning = run.schema_version === 1;
  return JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      [
        '-c',
        planning
          ? 'import json,sys;from datacenter_twin.contracts import Scenario;from datacenter_twin.engine import simulate;print(json.dumps(simulate(Scenario.from_dict(json.load(sys.stdin)))))'
          : 'import json,sys;from datacenter_twin.topology import SiteScenario;from datacenter_twin.continuity import simulate_continuity;print(json.dumps(simulate_continuity(SiteScenario.from_dict(json.load(sys.stdin))).to_dict()))',
      ],
      {
        cwd: '../..',
        input: JSON.stringify(planning ? run.assumptions : run.scenario),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    ),
  );
}

// These expectations come from power × time, efficiency products and the
// stated event times. Native equality additionally covers every exported field.
const expected: Record<string, [number, number]> = {
  'power-energy': [500, 250],
  'distribution-loss': [500 / 0.95, 500 / 0.9],
  'ride-through': [607.8, 453.9],
  'generator-delay': [330, 360],
  'generator-failure': [292.2, 0],
  'n-plus-one': [335, 0],
  'shared-controls': [1000, 335],
  'single-point': [1000 / 6, 0],
  precharge: [478.2675, 453.9],
  'ai-outage': [607.8, 478.2675],
  'recovery-deadline': [0.1865, 0],
  pue: [547500000, 503700000],
};

test('all twelve lessons run both exercises and export complete native-equal results', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto('./?lesson=power-energy');
  for (const lesson of lessons) {
    await page.getByLabel('Choose a lesson').selectOption(lesson.id);
    await expect(page.getByTestId('lesson-result')).toBeVisible();
    for (let exercise = 0; exercise < 2; exercise++) {
      if (exercise) {
        await page.getByRole('button', { name: 'Try the challenge value' }).click();
        await expect(
          page.getByText('Input changed. Run the lesson to update the result.'),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Run lesson', exact: true }).click();
        await expect(page.getByTestId('lesson-result')).toContainText(
          `Result for ${lesson.challenge}`,
        );
      }
      const run = await exported(page, lesson.id === 'pue');
      expect(run).toEqual(nativeRun(run));
      const actual =
        lesson.id === 'pue'
          ? run.facility_energy_kwh
          : lesson.resultKey === 'generator_ready'
            ? run.intervals.find(
                (row: { asset_states: Record<string, string> }) =>
                  row.asset_states.generator === 'running',
              )?.start_s
            : lesson.resultKey === 'depletion'
              ? run.events.find((event: { action: string }) => event.action === 'battery_depleted')
                  ?.at_s
              : run.summary[lesson.resultKey];
      expect(Number(actual)).toBeCloseTo(expected[lesson.id][exercise], 7);
      if (lesson.id !== 'pue') expect(run.summary.energy_balance_residual_kwh).toBe('0');
    }
    await page.getByRole('button', { name: 'Show worked answer' }).click();
    await expect(page.locator('.worked-answer')).toBeVisible();
  }
  await page.getByLabel('Verify against Python').check();
  await expect(page.getByTestId('python-verification-status')).toContainText(
    'Exact match with Python',
  );
});

test('cold first result requests no Python runtime or cover and records observed payload', async ({
  page,
  context,
}, testInfo) => {
  const responses: Promise<{ path: string; bytes: number }>[] = [];
  context.on('response', (response) => {
    if (response.url().startsWith('http://127.0.0.1:4174/'))
      responses.push(
        response.body().then((body) => ({
          path: new URL(response.url()).pathname,
          bytes: body.byteLength,
        })),
      );
  });
  const started = performance.now();
  await page.goto('./');
  await expect(page.getByTestId('served-power')).toHaveText('50,000 kW');
  const firstResultMs = performance.now() - started;
  const assets = await Promise.all(responses);
  expect(
    assets.some((asset) => /pyodide|engine\.zip|engine-manifest|cover/i.test(asset.path)),
  ).toBe(false);
  const decodedBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  expect(decodedBytes).toBeLessThan(600000);
  await writeFile(
    testInfo.outputPath('first-result-measurement.json'),
    JSON.stringify(
      {
        measured_at: new Date().toISOString(),
        scenario: 'ai_cluster_generator_failure',
        environment:
          'Fresh Playwright Chromium context; loopback Vite preview; no network or CPU throttle',
        first_result_ms: Math.round(firstResultMs),
        decoded_response_bytes: decodedBytes,
        assets,
        limitations:
          'One local observation; decoded payload, not a global visitor latency benchmark or compressed transfer size.',
      },
      null,
      2,
    ),
  );
});

test('course works at phone width and navigation returns to the simulator', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?lesson=ai-outage');
  await expect(page.getByTestId('lesson-result')).toContainText('607.8');
  await page.getByRole('button', { name: 'Try the challenge value' }).click();
  await page.getByRole('button', { name: 'Run lesson', exact: true }).click();
  await expect(page.getByTestId('lesson-result')).toContainText('478.2675');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/course-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Simulator', exact: true }).click();
  await expect(page.getByTestId('served-power')).toBeVisible();
  expect(new URL(page.url()).searchParams.has('lesson')).toBe(false);
});
