import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { lessons } from '../src/course-lessons';
import { exported, nativeRun, expectSceneLabelsVisible } from './course-test-helpers';

async function selectLesson(page: Page, id: string) {
  await page.getByLabel('Choose a lesson').selectOption(id);
  await expect(page.getByTestId('course')).toHaveAttribute('data-lesson', id);
  await expect(page.getByTestId('lesson-result')).toBeVisible();
}

async function runInput(page: Page, value: string) {
  await page.locator('.lesson-input-label input').fill(value);
  await page.getByRole('button', { name: 'Run lesson', exact: true }).click();
  await expect(page.getByTestId('lesson-result')).toContainText(`Result for ${value}`);
}

test('course atlas, predictions, replay and session review marks form one learning journey', async ({
  page,
}) => {
  await page.goto('./?lesson=power-energy');
  await expect(page.getByTestId('lesson-result')).toContainText('500');
  await page.getByText('Explore all 12 lessons', { exact: true }).click();
  await expect(page.getByRole('button', { name: /^Open lesson / })).toHaveCount(12);
  const themes = await page
    .locator('.course-map-card')
    .evaluateAll((cards) =>
      cards.map((card) => getComputedStyle(card).getPropertyValue('--lesson-accent').trim()),
    );
  expect(new Set(themes).size).toBe(12);
  await expect(page.getByRole('button', { name: /^Open lesson 1:/ })).toHaveAttribute(
    'aria-current',
    'step',
  );
  await page.getByText('Explore all 12 lessons', { exact: true }).click();

  await page.getByRole('button', { name: 'Try the challenge value' }).click();
  await page.getByLabel('Your prediction (kWh)').fill('250');
  await expect(page.getByTestId('prediction-feedback')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run lesson', exact: true }).click();
  await expect(page.getByTestId('prediction-feedback')).toContainText('Difference from result: 0');
  await expect(page.getByTestId('lesson-reference')).toContainText('500');
  await page.getByRole('button', { name: 'Mark as reviewed', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marked as reviewed' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Show worked answer' }).click();
  await page.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await expect(page.getByLabel('Choose a lesson')).toHaveValue('distribution-loss');
  await expect(page).toHaveURL(/lesson=distribution-loss/);
  await expect(page.locator('.worked-answer')).toHaveCount(0);
  await expect(page.locator('.lesson-prediction-label input')).toHaveValue('');
  await expect(page.getByLabel('Lesson replay interval', { exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Previous lesson', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marked as reviewed' })).toBeVisible();
  await expect(page.locator('.lesson-input-label input')).toHaveValue('1000');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mark as reviewed', exact: true })).toBeVisible();

  await selectLesson(page, 'ride-through');
  const scene = page.getByRole('region', { name: 'Lesson visualisation' });
  await scene.getByRole('button', { name: /asset down · utility/ }).click();
  await expect(scene.locator('output')).toContainText('300 s–310 s');
  await scene.getByRole('button', { name: /Battery energy store/ }).press('Enter');
  await expect(scene.locator('.lesson-scene-inspector h3')).toHaveText('Battery energy store');
  await scene.getByLabel('Inspect lesson component').selectOption('depletion');
  await expect(scene.locator('.lesson-scene-inspector h3')).toHaveText('Battery depletion event');
  await expect(scene.locator('.lesson-scene-inspector')).toContainText('607.8 s');
  await scene.getByRole('button', { name: 'Pause animation' }).click();
  await expect(scene).toHaveAttribute('data-motion', 'off');
  await scene.getByRole('button', { name: 'Resume animation' }).click();
  await expect(scene).toHaveAttribute('data-motion', 'on');
});

test('inclusive boundaries keep event wording, full service and complete Python equality', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('./?lesson=ride-through');
  await expect(page.getByTestId('lesson-result')).toBeVisible();
  await runInput(page, '0');
  await expect(page.getByTestId('lesson-result')).toContainText('Battery starts empty');
  let run = await exported(page);
  expect(run).toEqual(nativeRun(run));
  expect(Number(run.summary.unserved_it_kwh)).toBeCloseTo((1000 * 600) / 3600, 7);
  expect(run.events.some((event: { action: string }) => event.action === 'battery_depleted')).toBe(
    false,
  );

  await selectLesson(page, 'generator-delay');
  await runInput(page, '600');
  await expect(page.getByTestId('lesson-result')).toContainText('No generator-running interval');
  await expect(page.getByTestId('lesson-result')).toContainText('scheduled for 900 s');
  run = await exported(page);
  expect(run).toEqual(nativeRun(run));
  expect(
    run.intervals.some(
      (row: { asset_states: Record<string, string> }) => row.asset_states.generator === 'running',
    ),
  ).toBe(false);

  await selectLesson(page, 'n-plus-one');
  await runInput(page, '1500');
  run = await exported(page);
  expect(run).toEqual(nativeRun(run));
  expect(Number(run.summary.peak_unserved_kw)).toBe(0);
  expect(
    run.intervals.every(
      (row: { served_it_kw: string; requested_it_kw: string }) =>
        Number(row.served_it_kw) === Number(row.requested_it_kw),
    ),
  ).toBe(true);

  await selectLesson(page, 'pue');
  await runInput(page, '1');
  const planning = await exported(page, true);
  expect(planning).toEqual(nativeRun(planning));
  expect(Number(planning.it_energy_kwh)).toBe(50000 * 8760);
  expect(Number(planning.non_it_energy_kwh)).toBe(0);
  expect(planning.facility_energy_kwh).toBe(planning.it_energy_kwh);
  await expect(page.getByLabel('Lesson replay interval', { exact: true })).toHaveCount(0);
});

test('blank, off-step and out-of-range inputs cannot replace the completed lesson', async ({
  page,
}) => {
  await page.goto('./?lesson=power-energy');
  await expect(page.getByTestId('lesson-result')).toContainText('Result for 1000');
  const input = page.locator('.lesson-input-label input');
  for (const value of ['', '-100', '550', '2100']) {
    await input.fill(value);
    await page.getByRole('button', { name: 'Run lesson', exact: true }).click();
    expect(await input.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
    await expect(page.getByTestId('lesson-result')).toContainText('Result for 1000');
  }
  await runInput(page, '0');
  const run = await exported(page);
  expect(run).toEqual(nativeRun(run));
  expect(Number(run.summary.requested_it_kwh)).toBe(0);
  await expect(page.getByRole('region', { name: 'Lesson visualisation' })).not.toContainText(
    /NaN|Infinity/,
  );
});

test('every lesson has a responsive scene at phone, tablet and desktop sizes', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?lesson=power-energy');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const lesson of lessons) {
      await selectLesson(page, lesson.id);
      await expect(page.locator('.lesson-scene svg')).toBeVisible();
      await expectSceneLabelsVisible(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (
        (width === 1440 &&
          ['ride-through', 'shared-controls', 'ai-outage', 'pue'].includes(lesson.id)) ||
        (width === 320 && lesson.id === 'ai-outage')
      ) {
        await page.screenshot({
          path: testInfo.outputPath(`${lesson.id}-${width}.png`),
          fullPage: true,
        });
      }
      if (width === 1440 && lesson.id === 'ai-outage') {
        await page.getByRole('button', { name: 'Pause animation' }).click();
        await page.getByRole('region', { name: 'Current lesson' }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('course-studio.png') });
        await page.getByRole('button', { name: 'Resume animation' }).click();
      }
    }
  }
  expect(errors).toEqual([]);
});

test('reduced motion respects the device preference without removing interactive inspection', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?lesson=power-energy');
  await expect(page.getByTestId('lesson-result')).toBeVisible();
  const scene = page.getByRole('region', { name: 'Lesson visualisation' });
  await expect(scene).toHaveAttribute('data-motion', 'off');
  await expect(
    scene.getByRole('button', { name: 'Animation disabled by reduced motion preference' }),
  ).toBeDisabled();
  await scene.getByRole('button', { name: /Elapsed interval/ }).press('Enter');
  await expect(scene.locator('.lesson-scene-inspector')).toContainText('Elapsed');
  expect(
    await page
      .locator('[data-testid="course"]')
      .evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0);
});

test('cold course result loads original vectors without fetching the optional Python runtime', async ({
  page,
  context,
}, testInfo) => {
  const responses: Promise<{ path: string; bytes: number }>[] = [];
  context.on('response', (response) => {
    if (response.url().startsWith('http://127.0.0.1:4174/'))
      responses.push(
        response
          .body()
          .then((body) => ({ path: new URL(response.url()).pathname, bytes: body.byteLength })),
      );
  });
  const started = performance.now();
  await page.goto('./?lesson=ai-outage');
  await expect(page.getByTestId('lesson-result')).toContainText('607.8');
  const firstResultMs = Math.round(performance.now() - started);
  const assets = await Promise.all(responses);
  const bytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  expect(
    assets.some((asset) => /pyodide|engine\.zip|engine-manifest|cover|\.png/i.test(asset.path)),
  ).toBe(false);
  expect(bytes).toBeLessThan(750000);
  await writeFile(
    testInfo.outputPath('course-first-result-measurement.json'),
    JSON.stringify(
      {
        measured_at: new Date().toISOString(),
        lesson: 'ai-outage',
        environment:
          'Fresh Playwright Chromium context; loopback Vite preview; no network or CPU throttle',
        first_result_ms: firstResultMs,
        decoded_response_bytes: bytes,
        assets,
        limitations:
          'One local observation, not a global latency benchmark or compressed transfer size.',
      },
      null,
      2,
    ),
  );
});
