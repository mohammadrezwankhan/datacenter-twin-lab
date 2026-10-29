import { expect, test } from '@playwright/test';

test('fresh search catalog shows every entry before a query and hides the empty state', async ({
  page,
}) => {
  await page.goto('./learn/');

  const search = page.getByRole('searchbox', { name: 'Search a topic or question' });
  await expect(search).toHaveValue('');
  await expect(page.locator('.learning-card:visible')).toHaveCount(30);
  await expect(page.locator('#learning-count')).toHaveText('30 of 30 learning items shown');
  await expect(page.locator('.learn-empty')).toBeHidden();

  await search.fill('  BaTtErY  ');
  await expect(page).toHaveURL(/q=BaTtErY/);
  await expect(page.locator('.learning-card:visible')).toHaveCount(5);
  await page.getByRole('button', { name: 'Continuity', exact: true }).click();
  await expect(page).toHaveURL(/q=BaTtErY.*path=continuity/);
  await expect(page.locator('.learning-card:visible')).toHaveCount(1);
  await expect(page.locator('.learning-card:visible')).toHaveAttribute(
    'data-learning-id',
    'ride-through',
  );

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.learning-card:visible')).toHaveCount(30);
  await expect(page.locator('.learn-empty')).toBeHidden();
});
