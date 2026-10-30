import { expect, test } from '@playwright/test';

test('sidebar reference links have separate readable rows and an independent status badge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');
  const resources = page.locator('.sidebar-bottom');
  const course = resources.getByRole('link', { name: 'Course notes & worked answers →' });
  const evidence = resources.getByRole('link', { name: 'Reference results & sources →' });
  await expect(course).toBeVisible();
  await expect(evidence).toBeVisible();
  await expect(course).toHaveAttribute('href', './learn/');
  await expect(evidence).toHaveAttribute('href', './evidence/');
  const first = (await course.boundingBox())!;
  const second = (await evidence.boundingBox())!;
  const badge = (await resources.getByText('Local calculations').boundingBox())!;
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height + 4);
  expect(badge.y).toBeGreaterThanOrEqual(second.y + second.height + 4);
  expect(first.height).toBeGreaterThanOrEqual(44);
  expect(second.height).toBeGreaterThanOrEqual(44);
});

test('keyboard navigation reaches sidebar references in a short desktop window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto('./');
  const course = page.locator('.sidebar-bottom').getByRole('link').first();
  const evidence = page.locator('.sidebar-bottom').getByRole('link').nth(1);
  await page.locator('.sidebar-feature').getByRole('button', { name: 'Open the course' }).focus();
  for (const link of [course, evidence]) {
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const box = (await link.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(768);
    expect(
      await link.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
        );
      }),
    ).toBe(true);
  }
  await evidence.press('Enter');
  await expect(page).toHaveURL(/\/evidence\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
