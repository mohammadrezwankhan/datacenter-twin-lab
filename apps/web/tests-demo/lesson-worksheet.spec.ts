import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { lessons } from '../src/course-lessons';
import { buildLessonWorksheet } from '../src/lesson-worksheet';
import type { Run } from '../src/types';
import { exported, nativeRun } from './course-test-helpers';

async function worksheet(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download lesson worksheet', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^lesson-.+-worksheet\.html$/);
  return readFile((await download.path())!, 'utf8');
}

for (const lesson of lessons) {
  test(`${lesson.id}: both printable exercises preserve the complete native calculation`, async ({
    page,
    context,
  }, testInfo) => {
    await page.goto(`./?lesson=${lesson.id}`);
    await expect(page.getByTestId('lesson-result')).toBeVisible();
    const paper = await context.newPage();
    const externalRequests: string[] = [];
    paper.on('request', (request) => externalRequests.push(request.url()));
    for (const [exercise, input] of [lesson.initial, lesson.challenge].entries()) {
      await page.locator('.lesson-input-label input').fill(input);
      await page.locator('.lesson-prediction-label input').fill('123.45');
      await page.getByRole('button', { name: 'Run lesson', exact: true }).click();
      await expect(page.getByTestId('lesson-result')).toContainText(`Result for ${input}`);
      const run = await exported(page, lesson.id === 'pue');
      const html = await worksheet(page);
      await paper.setContent(html);
      const packet = JSON.parse((await paper.locator('#worksheet-evidence').textContent())!);
      expect(packet.lesson_id).toBe(lesson.id);
      expect(packet.selected_input).toBe(input);
      expect(packet.submitted_prediction).toBe('123.45');
      expect(packet.calculation).toEqual(run);
      expect(packet.calculation).toEqual(nativeRun(run));
      await expect(paper.locator('#submitted-prediction')).toContainText('123.45');
      await expect(paper.locator('#prediction-page #worksheet-result')).toHaveCount(0);
      await expect(paper.locator('#answer-page #worksheet-result')).toBeVisible();
      await expect(paper.locator('script,iframe,link,img')).toHaveCount(0);
      expect(externalRequests).toEqual([]);
      for (const format of ['A4', 'Letter'] as const) {
        const pdf = await paper.pdf({
          path: testInfo.outputPath(`${lesson.id}-${exercise}-${format}.pdf`),
          format,
          printBackground: true,
          displayHeaderFooter: false,
        });
        // Chromium emits one Page dictionary per physical page, separate from Pages.
        const pages = pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length;
        expect(pages, `${format}: prediction, answer and reproduction must stay separate`).toBe(3);
      }
    }
    await paper.close();
  });
}

test('worksheet captures the submitted estimate and completed input, preserving later drafts', async ({
  page,
  context,
}) => {
  await page.goto('./?lesson=ride-through');
  await expect(page.getByTestId('lesson-result')).toBeVisible();
  const paper = await context.newPage();
  await paper.setContent(await worksheet(page));
  let packet = JSON.parse((await paper.locator('#worksheet-evidence').textContent())!);
  expect(packet.submitted_prediction).toBeNull();
  await page.locator('.lesson-input-label input').fill('50');
  await page.locator('.lesson-prediction-label input').fill('450');
  await page.getByRole('button', { name: 'Run lesson', exact: true }).click();
  await expect(page.getByTestId('lesson-result')).toContainText('Result for 50');
  await page.locator('.lesson-input-label input').fill('100');
  await page.locator('.lesson-prediction-label input').fill('999');
  await paper.setContent(await worksheet(page));
  packet = JSON.parse((await paper.locator('#worksheet-evidence').textContent())!);
  expect(packet.selected_input).toBe('50');
  expect(packet.submitted_prediction).toBe('450');
  expect(packet.calculation.scenario.battery_initial_kwh).toBe('50');
  expect(packet.calculation.scenario.battery_charge_kw).toBe('0');
  await expect(paper.locator('#worksheet-result')).toHaveText('453.9 s elapsed');
  await expect(paper.locator('#answer-page')).toContainText('153.9 s of reserve');
  await expect(paper.locator('#answer-page')).toContainText('42.75 kWh deliverable');
  await page.getByLabel('Choose a lesson').selectOption('pue');
  await expect(page.getByTestId('lesson-result')).toContainText('Result for 1.25');
  await paper.setContent(await worksheet(page));
  packet = JSON.parse((await paper.locator('#worksheet-evidence').textContent())!);
  expect(packet.submitted_prediction).toBeNull();
  expect(packet.lesson_id).toBe('pue');
  expect(packet.calculation.energy_only_cost).toBeNull();
  await expect(paper.getByRole('row', { name: 'Energy-only cost Unknown' })).toBeVisible();
});

test('empty battery and no generator interval remain explicit absent events', async ({
  page,
  context,
}) => {
  const paper = await context.newPage();
  for (const [lesson, input, label] of [
    ['ride-through', '0', 'Battery starts empty'],
    ['generator-delay', '600', 'No generator-running interval'],
  ]) {
    await page.goto(`./?lesson=${lesson}`);
    await expect(page.getByTestId('lesson-result')).toBeVisible();
    await page.locator('.lesson-input-label input').fill(input);
    await page.getByRole('button', { name: 'Run lesson', exact: true }).click();
    await expect(page.getByTestId('lesson-result')).toContainText(`Result for ${input}`);
    await paper.setContent(await worksheet(page));
    await expect(paper.locator('#worksheet-result')).toHaveText(label);
    const packet = JSON.parse((await paper.locator('#worksheet-evidence').textContent())!);
    expect(packet.calculation).toEqual(nativeRun(packet.calculation));
  }
});

test('standalone worksheet escapes supplied text and remains usable on a phone', async ({
  page,
  context,
}, testInfo) => {
  await page.goto('./?lesson=ride-through');
  await expect(page.getByTestId('lesson-result')).toBeVisible();
  const run = (await exported(page)) as Run;
  const injection = '<img src="https://invalid.example/" onerror="alert(1)">';
  run.scenario.source_ids = [injection];
  const html = buildLessonWorksheet({
    lesson: { ...lessons.find((lesson) => lesson.id === 'ride-through')!, title: injection },
    input: '100',
    prediction: '500',
    equation: { formula: 'Energy / power = duration', note: injection },
    calculation: run,
    sourceRevision: '" onclick="alert(1)',
  });
  const paper = await context.newPage();
  await paper.setViewportSize({ width: 320, height: 900 });
  await paper.setContent(html);
  await expect(paper.locator('img,script,iframe,[onclick],[onerror]')).toHaveCount(0);
  await expect(paper.locator('h1')).toHaveText(injection);
  await expect(paper.locator('#evidence-page')).toContainText('Unknown for this build');
  expect(await paper.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page: paper }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(audit.violations).toEqual([]);
  await paper.screenshot({ path: testInfo.outputPath('worksheet-phone.png'), fullPage: true });
});
