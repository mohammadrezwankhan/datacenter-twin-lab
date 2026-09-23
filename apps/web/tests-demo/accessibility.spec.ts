import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { lessons } from '../src/course-lessons';

async function check(page: Page, state: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    result.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    })),
    state,
  ).toEqual([]);
}

test('guided prediction, result and research evidence pass the focused accessibility audit', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByTestId('guide-run')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to experiment' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await check(page, 'guided prediction');
  await page.getByTestId('guide-prediction').fill('300');
  await page.getByTestId('guide-run').click();
  await expect(page.getByTestId('guide-result')).toBeVisible();
  await expect(page.locator('.guided-live-status')).toContainText('307.8');
  await check(page, 'guided result');
  await page.getByRole('button', { name: 'Research evidence', exact: true }).click();
  await expect(page.locator('.proof-case')).toHaveCount(3);
  await check(page, 'research evidence');
});

test('all twelve lesson themes and advanced source controls pass the focused accessibility audit', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?lesson=power-energy');
  for (const lesson of lessons) {
    await page.getByLabel('Choose a lesson').selectOption(lesson.id);
    await expect(page.getByTestId('lesson-result')).toBeVisible();
    await check(page, lesson.id);
  }
  await page.getByRole('button', { name: 'Advanced workspace', exact: true }).click();
  await expect(page.getByTestId('served-power')).toBeVisible();
  await check(page, 'advanced overview');
  await page.getByRole('button', { name: 'Power topology', exact: true }).click();
  await expect(page.getByRole('button', { name: /View source for/ })).toBeVisible();
  await page.locator('.assumptions > summary').click();
  await expect(page.getByRole('button', { name: 'Open evidence register' })).toBeVisible();
  await check(page, 'topology');
  await page.getByRole('button', { name: 'Open evidence register' }).click();
  await expect(page.getByRole('heading', { name: 'Hardware reference options' })).toBeVisible();
  await check(page, 'source register');
});
