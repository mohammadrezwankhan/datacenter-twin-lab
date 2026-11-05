/** Read-only, reproducible layout regressions on the project's existing Vite preview. */
import { expect, test } from '@playwright/test';

const MATRIX = [
  { name: '4k-desktop', width: 3840, height: 2160, dpr: 1, touch: false },
  { name: 'fhd-desktop', width: 1920, height: 1080, dpr: 1, touch: false },
  { name: 'desktop-1440', width: 1440, height: 900, dpr: 1, touch: false },
  { name: 'small-desktop', width: 1280, height: 720, dpr: 1, touch: false },
  { name: 'ipad-pro-portrait', width: 1024, height: 1366, dpr: 2, touch: true },
  { name: 'ipad-pro-landscape', width: 1366, height: 1024, dpr: 2, touch: true },
  { name: 'ipad-air', width: 820, height: 1180, dpr: 2, touch: true },
  { name: 'android-tablet', width: 800, height: 1280, dpr: 2, touch: true },
  { name: 'iphone-pro', width: 393, height: 852, dpr: 3, touch: true },
  { name: 'pixel-8', width: 412, height: 915, dpr: 2.625, touch: true },
  { name: 'galaxy-s24', width: 360, height: 780, dpr: 3, touch: true },
  { name: 'galaxy-s24-ultra', width: 412, height: 915, dpr: 3, touch: true },
  { name: 'compact-360', width: 360, height: 640, dpr: 2, touch: true },
] as const;

for (const profile of MATRIX) {
  test(`${profile.name}: course and simulator have no outer overflow; targets are measurable`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120_000);
    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== 'string') throw new Error('Expected configured demo baseURL');
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr,
      isMobile: profile.touch,
      hasTouch: profile.touch,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().startsWith(new URL(baseURL).origin))
        errors.push(`HTTP ${String(response.status())}: ${response.url()}`);
    });
    const readings: unknown[] = [];
    try {
      for (const route of ['./', './?lesson=power-energy', './?mode=advanced']) {
        await page.goto(new URL(route, baseURL).toString(), { waitUntil: 'domcontentloaded' });
        if (route.includes('lesson=')) {
          await expect(page.getByTestId('lesson-result')).toBeVisible();
        } else if (route.includes('advanced')) {
          await expect(page.getByTestId('served-power')).toBeVisible();
        } else {
          await expect(
            page.getByRole('heading', { name: /How long will the battery last\?/i }),
          ).toBeVisible();
        }
        const observation = await page.evaluate(() => {
          const root = document.documentElement;
          const outerOverflow = Math.max(
            0,
            root.scrollWidth - root.clientWidth,
            document.body.scrollWidth - root.clientWidth,
          );
          const controls = [
            ...document.querySelectorAll<HTMLElement>(
              '.nav-item, .heading-actions button, button, input[type="range"], [role="slider"]',
            ),
          ].filter((element) => {
            const bounds = element.getBoundingClientRect();
            const styles = getComputedStyle(element);
            return (
              bounds.width > 0 &&
              bounds.height > 0 &&
              styles.visibility !== 'hidden' &&
              styles.display !== 'none' &&
              !element.closest('[aria-hidden="true"]')
            );
          });
          const undersized = controls
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width < 48 || rect.height < 48;
            })
            .map((element) => ({
              element: element.tagName.toLowerCase(),
              role: element.getAttribute('role'),
              name: (element.getAttribute('aria-label') || element.textContent || '')
                .trim()
                .slice(0, 80),
              width: Math.round(element.getBoundingClientRect().width),
              height: Math.round(element.getBoundingClientRect().height),
            }));
          const uncontainedTables = [...document.querySelectorAll<HTMLTableElement>('table')]
            .filter((table) => table.getBoundingClientRect().width > root.clientWidth)
            .filter((table) => {
              for (
                let parent = table.parentElement;
                parent && parent !== document.body;
                parent = parent.parentElement
              ) {
                const style = getComputedStyle(parent);
                if (
                  /(auto|scroll)/.test(style.overflowX) &&
                  parent.clientWidth < parent.scrollWidth
                )
                  return false;
              }
              return true;
            }).length;
          return {
            route: location.pathname + location.search,
            outerOverflow,
            uncontainedTables,
            visibleTargets: controls.length,
            undersizedTargets: undersized,
            devicePixelRatio: window.devicePixelRatio,
            width: root.clientWidth,
          };
        });
        readings.push(observation);
        expect(
          observation.outerOverflow,
          `${profile.name} ${route}: root horizontal overflow`,
        ).toBeLessThanOrEqual(1);
        expect(
          observation.uncontainedTables,
          `${profile.name} ${route}: uncontained wide tables`,
        ).toBe(0);
        if (profile.touch) {
          // Applies to interactive targets, not just painted icon glyphs; violations
          // identify elements that need a larger clickable box or spacing.
          expect(
            observation.undersizedTargets,
            `${profile.name} ${route}: 48px touch gate`,
          ).toEqual([]);
        }
      }
      expect(errors, `${profile.name}: uncaught JS or same-origin HTTP failures`).toEqual([]);
    } finally {
      await testInfo.attach(`matrix-${profile.name}`, {
        body: JSON.stringify({ profile, readings, errors }, null, 2),
        contentType: 'application/json',
      });
      await context.close();
    }
  });
}
