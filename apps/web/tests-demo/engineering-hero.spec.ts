import { requiredPresent } from '../src/required-value';
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configuredHeroFlag = readFileSync(new URL('../.env.demo', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith('VITE_ENGINEERING_HERO='))
  ?.slice('VITE_ENGINEERING_HERO='.length)
  .replace(/^['"]|['"]$/g, '');
const enabled = (process.env.VITE_ENGINEERING_HERO ?? configuredHeroFlag) === '1';

test('the engineering film is opt-in and preserves the start experience', async ({ page }) => {
  test.setTimeout(45000);
  let adapterRequests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/khan-grid-hero.js')) adapterRequests += 1;
  });
  await page.route('**/khan-grid-hero.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `customElements.define('khan-grid-hero', class extends HTMLElement {
        connectedCallback() { this.setAttribute('data-ready', 'true'); }
      });`,
    }),
  );

  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'How long will the battery last?' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'A five-minute power-continuity experiment for datacenter engineers. Predict, run, explain.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByTestId('guide-run')).toBeVisible();
  await expect(page.getByRole('button', { name: '24 browser lessons' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open the course' })).toBeVisible();

  const hero = page.getByTestId('engineering-hero');
  if (!enabled) {
    await expect(hero).toHaveCount(0);
    expect(adapterRequests).toBe(0);
    return;
  }

  await expect(hero).toBeVisible();
  await expect(hero).toContainText('A 15-second conceptual engineering animation.');
  await expect(hero).toContainText('not live telemetry');
  await expect(hero.locator('.engineering-hero-frame')).not.toHaveAttribute(
    'style',
    /aspect-ratio|overflow/,
  );
  await expect(hero.locator('khan-grid-hero')).toHaveAttribute('site', 'khanlab');
  await expect(hero.locator('khan-grid-hero')).toHaveAttribute('mode', 'video');
  await expect(hero.locator('khan-grid-hero')).toHaveAttribute(
    'video-src',
    /\/assets\/engineering-hero\/v1\/hero-1080p60\.mp4$/,
  );
  await expect(hero.locator('khan-grid-hero')).toHaveAttribute(
    'poster-src',
    /\/assets\/engineering-hero\/v1\/poster\.png$/,
  );
  await expect(hero.locator('khan-grid-hero')).toHaveAttribute('hide-cta', '');
  await expect(hero.locator('khan-grid-hero')).toHaveAttribute('data-ready', 'true');
  await expect(hero.locator('khan-grid-hero')).not.toHaveAttribute('autoplay', '');
  await expect(hero.locator('khan-grid-hero')).not.toHaveAttribute('loop', '');
});

test('late adapter registration is safe across start-page unmount and remount', async ({
  page,
}) => {
  test.skip(!enabled, 'The custom element is loaded only in the opt-in build.');
  test.setTimeout(45000);

  let releaseAdapter!: () => void;
  let markRequested!: () => void;
  let adapterRequests = 0;
  const adapterResponse = new Promise<void>((resolve) => {
    releaseAdapter = resolve;
  });
  const adapterRequested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  await page.route('**/khan-grid-hero.js', async (route) => {
    adapterRequests += 1;
    markRequested();
    await adapterResponse;
    await route.fulfill({
      contentType: 'text/javascript',
      body: `customElements.define('khan-grid-hero', class extends HTMLElement {
        connectedCallback() { this.setAttribute('data-ready', 'true'); }
      });`,
    });
  });

  await page.goto('./');
  await adapterRequested;
  await expect(page.getByTestId('engineering-hero')).toBeVisible();
  await expect(page.locator('.engineering-hero-frame')).toHaveCSS('aspect-ratio', '16 / 9');
  await expect(page.locator('.engineering-hero-frame')).toHaveCSS('overflow', 'hidden');
  await expect(page.locator('.engineering-hero-fallback')).toHaveAttribute(
    'src',
    /\/assets\/engineering-hero\/v1\/poster\.png$/,
  );
  await expect(page.getByTestId('engineering-hero')).toContainText(
    'A 15-second conceptual engineering animation.',
  );
  await page.getByRole('button', { name: /browser lessons/ }).click();
  await expect(page.getByRole('heading', { name: 'Power systems, made visible.' })).toBeVisible();
  releaseAdapter();
  await page.waitForFunction(() => customElements.get('khan-grid-hero') !== undefined);
  await expect(page.getByTestId('engineering-hero')).toHaveCount(0);

  await page.getByRole('button', { name: 'Start here' }).click();
  await expect(page.getByTestId('engineering-hero').locator('khan-grid-hero')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(page.locator('.engineering-hero-frame')).not.toHaveAttribute(
    'style',
    /aspect-ratio|overflow/,
  );
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const host = await page.locator('khan-grid-hero').boundingBox();
    const hero = await page.getByTestId('engineering-hero').boundingBox();
    expect(host).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(requiredPresent(host, 'host').x).toBeGreaterThanOrEqual(requiredPresent(hero, 'hero').x);
    expect(
      requiredPresent(host, 'host').x + requiredPresent(host, 'host').width,
    ).toBeLessThanOrEqual(
      requiredPresent(hero, 'hero').x + requiredPresent(hero, 'hero').width + 1,
    );
    await expect(
      page.getByTestId('engineering-hero').locator('.engineering-hero-summary'),
    ).toBeVisible();
  }
  expect(adapterRequests).toBe(1);
});

test('the verified adapter fits mobile, tablet, and desktop without clipping copy or controls', async ({
  page,
}) => {
  test.skip(!enabled, 'The verified custom element is loaded only in the opt-in build.');
  test.setTimeout(45000);

  await page.goto('./');
  const hero = page.getByTestId('engineering-hero');
  const adapter = hero.locator('khan-grid-hero');
  const play = adapter.getByRole('button', { name: 'Play animation' });
  const copy = page.getByText(/Illustrative telemetry; not live data, certified acceptance/);
  await expect(hero).toBeVisible();
  await expect(play).toBeVisible();
  await expect(copy).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'How long will the battery last?' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open the course' })).toBeVisible();
  await expect(adapter).not.toHaveAttribute('autoplay', '');
  await expect(adapter).not.toHaveAttribute('loop', '');

  // The Playwright demo preview can be mounted at a repository subpath as well as `/`.
  // Resolve release assets from the active app root so both deployments exercise the same files.
  const appRoot = page.url();
  const appUrl = (path: string) => new URL(path, appRoot).toString();
  const cspResponse = await page.request.get(appUrl('assets/engineering-hero/v1/csp.json'));
  expect(cspResponse.ok()).toBeTruthy();
  const releaseCsp = (await cspResponse.json()) as {
    suggestedContentSecurityPolicy: string;
  };
  const frameResponses = await Promise.all(
    ['assets/engineering-hero/v1/index.html', 'assets/engineering-hero/v1/'].map((path) =>
      page.request.get(appUrl(path)),
    ),
  );
  for (const response of frameResponses) {
    expect(response.headers()['content-security-policy']).toBe(
      releaseCsp.suggestedContentSecurityPolicy,
    );
    expect(response.headers()['x-frame-options']).toBeUndefined();
  }
  const hostResponse = await page.request.get(appRoot);
  expect(hostResponse.headers()['content-security-policy']).not.toBe(
    releaseCsp.suggestedContentSecurityPolicy,
  );

  const screenshotDirectory = process.env.TWIN_DEMO_SCREENSHOT_DIR;
  if (screenshotDirectory) mkdirSync(resolve(screenshotDirectory), { recursive: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(play).toBeVisible();
    await expect(copy).toBeVisible();
    await expect(page.getByRole('button', { name: '24 browser lessons' })).toBeVisible();
    await expect(hero.locator('.engineering-hero-summary')).toBeVisible();
    const layout = await adapter.evaluate((element) => {
      const frame = element.shadowRoot?.querySelector('[part="frame"]');
      const controls = element.shadowRoot?.querySelector('.controls');
      const copyElement = element.shadowRoot?.querySelector('.copy');
      const rect = (node: Element | null | undefined) => {
        const bounds = node?.getBoundingClientRect();
        return bounds
          ? { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }
          : null;
      };
      const hostBounds = element.getBoundingClientRect();
      const hostStyle = getComputedStyle(element);
      const wrapper = element.parentElement;
      if (!wrapper) throw new Error('Expected engineering hero wrapper');
      return {
        viewportWidth: window.innerWidth,
        host: rect(element),
        frame: rect(frame),
        controls: rect(controls),
        copy: rect(copyElement),
        hostHeight: hostBounds.height,
        hostScrollHeight: element.scrollHeight,
        hostOverflow: hostStyle.overflow,
        wrapperOverflow: getComputedStyle(wrapper).overflow,
      };
    });
    expect(layout.host).not.toBeNull();
    expect(layout.frame).not.toBeNull();
    expect(layout.controls).not.toBeNull();
    expect(layout.copy).not.toBeNull();
    expect(requiredPresent(layout.host, 'layout.host').left).toBeGreaterThanOrEqual(-1);
    expect(requiredPresent(layout.host, 'layout.host').right).toBeLessThanOrEqual(
      viewport.width + 1,
    );
    expect(requiredPresent(layout.frame, 'layout.frame').left).toBeGreaterThanOrEqual(
      requiredPresent(layout.host, 'layout.host').left - 1,
    );
    expect(requiredPresent(layout.frame, 'layout.frame').right).toBeLessThanOrEqual(
      requiredPresent(layout.host, 'layout.host').right + 1,
    );
    expect(requiredPresent(layout.controls, 'layout.controls').bottom).toBeLessThanOrEqual(
      requiredPresent(layout.frame, 'layout.frame').bottom + 1,
    );
    expect(requiredPresent(layout.copy, 'layout.copy').top).toBeGreaterThanOrEqual(
      requiredPresent(layout.frame, 'layout.frame').bottom - 1,
    );
    expect(requiredPresent(layout.copy, 'layout.copy').bottom).toBeLessThanOrEqual(
      requiredPresent(layout.host, 'layout.host').bottom + 1,
    );
    expect(layout.hostScrollHeight).toBeLessThanOrEqual(layout.hostHeight + 1);
    expect(layout.hostOverflow).not.toMatch(/hidden|clip/);
    expect(layout.wrapperOverflow).not.toMatch(/hidden|clip/);

    if (screenshotDirectory)
      await page.screenshot({
        path: resolve(
          screenshotDirectory,
          `engineering-hero-${String(viewport.width)}x${String(viewport.height)}.png`,
        ),
        fullPage: true,
        animations: 'disabled',
      });
  }
});
