import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const accessibilityTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function openEmt(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?mode=emt');
  await expect(page.getByRole('heading', { name: 'Inside a voltage sag' })).toBeVisible();
}

async function openResearch(
  page: import('@playwright/test').Page,
  study: 'load-step' | 'modal' = 'load-step',
) {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`./?study=${study}`);
  await expect(
    page.getByRole('heading', {
      name: study === 'modal' ? 'Read the system modes' : 'A step in demand',
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: study === 'modal' ? /Run modal study/i : /Run load step/i })
    .click();
  await expect(page.locator('.research-chart-card').first()).toBeVisible({ timeout: 180000 });
  const tables = page.locator('.research-data-details > summary');
  await expect(tables.first()).toBeVisible();
  for (const summary of await tables.all()) await summary.click();
}

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('responsive-20261028 EMT SVG controls name each visible label and reading', async ({
  page,
}) => {
  await openEmt(page);
  const devices = page.locator('.emt-device');
  const visibleContent = await devices.evaluateAll((elements) =>
    elements.map((element) => ({
      label: element.querySelector('.emt-label')?.textContent?.trim() ?? '',
      value: element.querySelector('.emt-value')?.textContent?.trim() ?? '',
    })),
  );
  expect(visibleContent).toHaveLength(5);
  for (const [index, item] of visibleContent.entries()) {
    expect(item.label).not.toBe('');
    expect(item.value).not.toBe('');
    await expect(devices.nth(index)).toHaveAccessibleName(
      new RegExp(`${escapedPattern(item.label)}\\s+${escapedPattern(item.value)}`, 'i'),
    );
    await expect(devices.nth(index)).toHaveAccessibleDescription(/Select for details/i);
  }
});

test('responsive-20261028 EMT sample table passes WCAG 2.2 AA axe', async ({ page }, testInfo) => {
  await openEmt(page);
  await page.locator('.emt-samples > summary').click();
  const violations = (
    await new AxeBuilder({ page }).withTags(accessibilityTags).analyze()
  ).violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map(({ target }) => target),
  }));
  await testInfo.attach('responsive-20261028-emt-wcag22aa-violations.json', {
    body: Buffer.from(JSON.stringify(violations, null, 2)),
    contentType: 'application/json',
  });
  expect(violations).toEqual([]);
});

test('responsive-20261028 EMT sample table scroll region is named, tabbable and ArrowRight-scrollable', async ({
  page,
}) => {
  await openEmt(page);
  const summary = page.locator('.emt-samples > summary');
  await summary.click();
  const tableRegion = page.locator('.emt-table-scroll');
  await expect(tableRegion).toBeVisible();
  await expect(tableRegion).toHaveAttribute('role', 'region');
  await expect(tableRegion).toHaveAttribute('aria-label', 'Sampled transient values');
  await expect(tableRegion).toHaveAttribute('tabindex', '0');

  await summary.focus();
  await page.keyboard.press('Tab');
  await expect(tableRegion).toBeFocused();
  const focusStyle = await tableRegion.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) };
  });
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);

  const dimensions = await tableRegion.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(dimensions.scrollLeft);
});

test('responsive-20261028 power-dynamics tables pass WCAG 2.2 AA axe', async ({
  page,
}, testInfo) => {
  await openResearch(page);
  const violations = (
    await new AxeBuilder({ page }).withTags(accessibilityTags).analyze()
  ).violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map(({ target }) => target),
  }));
  await testInfo.attach('responsive-20261028-power-dynamics-wcag22aa-violations.json', {
    body: Buffer.from(JSON.stringify(violations, null, 2)),
    contentType: 'application/json',
  });
  expect(violations).toEqual([]);

  const tableRegions = page.locator('.research-table-scroll');
  expect(await tableRegions.count()).toBeGreaterThan(0);
  for (const region of await tableRegions.all()) {
    await expect(region).toHaveAttribute('role', 'region');
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region).toHaveAttribute('aria-label', /data table/i);
  }
});

test('responsive-20261028 power-dynamics data table accepts Tab and ArrowRight scrolling', async ({
  page,
}) => {
  await openResearch(page);
  const summary = page.locator('.research-data-details > summary').first();
  const tableRegion = page.locator('.research-table-scroll').first();
  await expect(tableRegion).toBeVisible();
  await expect(tableRegion).toHaveAttribute('role', 'region');
  await expect(tableRegion).toHaveAttribute('aria-label', /data table/i);
  await expect(tableRegion).toHaveAttribute('tabindex', '0');
  await summary.focus();
  await page.keyboard.press('Tab');
  await expect(tableRegion).toBeFocused();
  const focusStyle = await tableRegion.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) };
  });
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
  const dimensions = await tableRegion.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(dimensions.scrollLeft);
});

test('responsive-20261028 modal study table is accessible and keyboard-scrollable', async ({
  page,
}, testInfo) => {
  await openResearch(page, 'modal');
  const violations = (
    await new AxeBuilder({ page }).withTags(accessibilityTags).analyze()
  ).violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map(({ target }) => target),
  }));
  await testInfo.attach('responsive-20261028-modal-wcag22aa-violations.json', {
    body: Buffer.from(JSON.stringify(violations, null, 2)),
    contentType: 'application/json',
  });
  expect(violations).toEqual([]);

  const summary = page.locator('.research-mode-card .research-data-details > summary');
  const tableRegion = page.locator('.research-mode-card .research-table-scroll');
  await expect(tableRegion).toBeVisible();
  await expect(tableRegion).toHaveAttribute('role', 'region');
  await expect(tableRegion).toHaveAttribute('aria-label', 'Eigenvalue mode data table');
  await expect(tableRegion).toHaveAttribute('tabindex', '0');
  await summary.focus();
  await page.keyboard.press('Tab');
  await expect(tableRegion).toBeFocused();
  const focusStyle = await tableRegion.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) };
  });
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
  const dimensions = await tableRegion.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(dimensions.scrollLeft);
});

test('responsive-20261028 EMT and dynamics studies reflow at phone and tablet widths', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const viewports = [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ];
  const routes = [
    { path: './?mode=emt', heading: 'Inside a voltage sag' },
    { path: './?study=load-step', heading: 'A step in demand' },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      const layout = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      }));
      expect(
        layout.documentWidth - layout.viewportWidth,
        `${route.path} at ${viewport.width}px`,
      ).toBeLessThanOrEqual(1);

      if (route.path.includes('study=')) {
        const targetHeights = await page
          .locator('.research-footer a')
          .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
        expect(targetHeights).toHaveLength(2);
        for (const height of targetHeights) expect(height).toBeGreaterThanOrEqual(24);
      }
    }
  }
});
