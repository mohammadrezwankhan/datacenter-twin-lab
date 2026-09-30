import { test, expect } from '@playwright/test';

test('curriculum tabs expose the original lesson and study routes with keyboard and phone support', async ({
  page,
}) => {
  await page.goto('./?lesson=power-energy');

  const foundations = page.getByRole('tab', { name: /Foundations/ });
  const facility = page.getByRole('tab', { name: /Facility Architecture/ });
  const power = page.getByRole('tab', { name: /Power Dynamics & Transients/ });
  await expect(foundations).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('link', { name: /^Lesson [1-5] ·/ })).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'Lesson 1 · Power becomes energy' })).toHaveAttribute(
    'href',
    '?lesson=power-energy',
  );

  await foundations.focus();
  await foundations.press('ArrowRight');
  await expect(facility).toBeFocused();
  await expect(facility).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('link', { name: /^Lesson (6|7|8|9|10|11|12) ·/ })).toHaveCount(7);
  await expect(
    page.getByRole('link', { name: 'Lesson 6 · Check a surviving path' }),
  ).toHaveAttribute('href', '?lesson=n-plus-one');

  await facility.press('ArrowRight');
  await expect(power).toBeFocused();
  await expect(power).toHaveAttribute('aria-selected', 'true');
  const studyLinks = page.getByRole('navigation', {
    name: 'Power Dynamics & Transients lessons and studies',
  });
  await expect(studyLinks.getByRole('link')).toHaveCount(6);
  await expect(
    studyLinks.getByRole('link', { name: 'EMT · Electromagnetic transients' }),
  ).toHaveAttribute('href', '?mode=emt');
  for (const studyId of [
    'load-step',
    'modal',
    'forced-response',
    'model-comparison',
    'grid-network',
  ]) {
    await expect(studyLinks.locator(`a[href="?study=${studyId}"]`)).toBeVisible();
  }

  await page.setViewportSize({ width: 320, height: 780 });
  await expect(page.locator('.curriculum-tracks')).toBeVisible();
  const trackPanel = page.locator('.curriculum-tracks');
  const fitsPhone = await trackPanel.evaluate(
    (element) => element.scrollWidth <= element.clientWidth,
  );
  expect(fitsPhone).toBe(true);
});
