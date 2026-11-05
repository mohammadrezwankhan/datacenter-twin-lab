import { expect, test } from '@playwright/test';

// Browser regression cases for CI. The audit patch environment does not run Playwright.
test('workspace Back and Forward restore views and remove unrelated fragments', async ({
  page,
}) => {
  await page.goto('./#guided-output');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('button', { name: '24 browser lessons' }).click();
  await expect(page).toHaveURL(/\?lesson=power-energy$/);
  await nav.getByRole('button', { name: 'EMT study', exact: true }).click();
  await expect(page).toHaveURL(/\?mode=emt$/);
  await page.goBack();
  await expect(page).toHaveURL(/\?lesson=power-energy$/);
  await expect(nav.getByRole('button', { name: '24 browser lessons' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.goForward();
  await expect(nav.getByRole('button', { name: 'EMT study', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const length = await page.evaluate(() => history.length);
  await nav.getByRole('button', { name: 'EMT study', exact: true }).click();
  expect(await page.evaluate(() => history.length)).toBe(length);
  await nav.getByRole('button', { name: 'Advanced workspace', exact: true }).click();
  await nav.getByRole('button', { name: 'Power topology', exact: true }).click();
  await nav.getByRole('button', { name: 'Energy systems', exact: true }).click();
  await page.goBack();
  await expect(nav.getByRole('button', { name: 'Power topology', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('study history restores the selection and invalidates pending results', async ({ page }) => {
  await page.goto('./?study=load-step');
  const studio = page.getByTestId('research-studio');
  const choices = page
    .getByRole('navigation', { name: 'Choose a power-dynamics study' })
    .getByRole('button');
  await page.getByTestId('research-run').click();
  await choices.nth(1).click();
  await expect(studio).toHaveAttribute('data-study', 'modal');
  await choices.nth(2).click();
  await expect(studio).toHaveAttribute('data-study', 'forced-response');
  await page.goBack();
  await expect(studio).toHaveAttribute('data-study', 'modal');
  await expect(page.getByTestId('research-results')).toContainText('No applied result yet');
  await expect(page.getByTestId('research-run')).toBeEnabled();
  await page.goBack();
  await expect(studio).toHaveAttribute('data-study', 'load-step');
  await expect(page.getByTestId('research-results')).toContainText('No applied result yet');
  await page.goForward();
  await expect(studio).toHaveAttribute('data-study', 'modal');
});

test('Back restores an explicitly identified valid preset without adding history', async ({
  page,
}) => {
  await page.goto('./?mode=advanced&preset=ai_cluster_generator_failure');
  const scenario = page.getByRole('combobox', { name: 'Scenario', exact: true });
  await expect(scenario).toBeEnabled();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('button', { name: 'Power topology', exact: true }).click();
  await scenario.selectOption('ai_cluster_50mw_ramp');
  await expect(scenario).toBeEnabled();
  await expect(scenario).toHaveValue('ai_cluster_50mw_ramp');
  const length = await page.evaluate(() => history.length);
  await page.goBack();
  await expect(
    nav.getByRole('button', { name: 'Advanced workspace', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(scenario).toHaveValue('ai_cluster_generator_failure');
  await expect(scenario).toBeEnabled();
  await expect(page).toHaveURL(/preset=ai_cluster_generator_failure/);
  expect(await page.evaluate(() => history.length)).toBe(length);
});
