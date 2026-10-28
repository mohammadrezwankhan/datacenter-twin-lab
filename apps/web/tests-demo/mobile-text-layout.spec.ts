import { expect, test } from '@playwright/test';
import { courseCatalog } from '../src/curriculum';

test('infrastructure lesson labels wrap at 320px with enlarged text', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await page.goto(`${testInfo.project.use.baseURL}?lesson=evidence-load-ledger`);
    await expect(page.locator('.infra-lesson-nav')).toBeVisible();
    // User text sizing and platform font metrics must not force long words outside a button.
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    const overflow = await page.locator('.infra-lesson-nav button').evaluateAll((buttons) =>
      buttons.flatMap((button) => {
        const box = button.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(button);
        const text = range.getBoundingClientRect();
        return text.left < box.left || text.right > box.right ? [button.textContent?.trim()] : [];
      }),
    );
    expect(overflow).toEqual([]);
  } finally {
    await context.close();
  }
});

test('responsive-20261028 infrastructure track heading stays inside its panel at 200% text', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await page.goto(`${testInfo.project.use.baseURL}?lesson=evidence-load-ledger`);
    const heading = page.locator('.curriculum-track-panel-copy h3');
    await expect(heading).toHaveText('Infrastructure Engineering');
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await heading.scrollIntoViewIfNeeded();
    const bounds = await heading.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        textLeft: text.left,
        textRight: text.right,
        boxLeft: box.left,
        boxRight: box.right,
        fontSize: getComputedStyle(element).fontSize,
      };
    });
    await testInfo.attach('responsive-20261028-infrastructure-track-heading.json', {
      body: Buffer.from(JSON.stringify(bounds, null, 2)),
      contentType: 'application/json',
    });
    expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    expect(bounds.textLeft).toBeGreaterThanOrEqual(bounds.boxLeft - 2);
    expect(bounds.textRight).toBeLessThanOrEqual(bounds.boxRight + 2);
  } finally {
    await context.close();
  }
});

for (const width of [320, 360, 390, 560, 768, 900, 1440]) {
  test(`touch navigation keeps labels inside separate buttons at ${width}px`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    try {
      for (const route of [
        '',
        '?mode=advanced',
        '?lesson=evidence-load-ledger',
        '?mode=emt',
        '?study=load-step',
      ]) {
        await page.goto(`${testInfo.project.use.baseURL}${route}`);
        await expect(page.locator('.nav-item').first()).toBeVisible();
        const labels = await page.locator('.nav-item').evaluateAll((buttons) =>
          buttons.map((button) => {
            const box = button.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(button);
            const text = range.getBoundingClientRect();
            return {
              name: button.textContent?.trim(),
              contained: text.left >= box.left && text.right <= box.right,
              width: box.width,
              height: box.height,
            };
          }),
        );
        expect(
          labels.filter((label) => !label.contained || label.width < 48 || label.height < 48),
          route,
        ).toEqual([]);
        await expect(page.locator('html')).toHaveJSProperty(
          'scrollWidth',
          await page.locator('html').evaluate((el) => el.clientWidth),
        );
      }
    } finally {
      await context.close();
    }
  });
}

for (const width of [320, 390]) {
  test(`all 24 lessons contain their headings and button labels at ${width}px`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    try {
      for (const lesson of courseCatalog) {
        await page.goto(`${testInfo.project.use.baseURL}?lesson=${lesson.id}`);
        await expect(page.locator('.course-studio, .infrastructure-course')).toBeVisible();
        const overflow = await page
          .locator('main button, main h1, main h2, main h3')
          .evaluateAll((elements) =>
            elements
              .filter((element) => element.checkVisibility())
              .flatMap((element) => {
                const box = element.getBoundingClientRect();
                const range = document.createRange();
                range.selectNodeContents(element);
                const text = range.getBoundingClientRect();
                return text.left < box.left - 2 || text.right > box.right + 2
                  ? [element.textContent?.trim()]
                  : [];
              }),
          );
        expect(overflow, lesson.id).toEqual([]);
      }
    } finally {
      await context.close();
    }
  });
}
