import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Rect = { x: number; y: number; width: number; height: number } | null;

async function geometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rect = (element: Element | null | undefined): Rect => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const hero = document.querySelector<HTMLElement>('[data-testid="engineering-hero"]');
    const adapter = hero?.querySelector<HTMLElement>('khan-grid-hero');
    const fallback = hero?.querySelector<HTMLImageElement>('.engineering-hero-fallback');
    const fallbackCopy = hero?.querySelector('.engineering-hero-copy');
    const guideRun = document.querySelector('[data-testid="guide-run"]');
    const heading = document.querySelector('main h1');
    const navigation = document.querySelector('nav[aria-label="Main navigation"]');
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      heading: rect(heading),
      navigation: rect(navigation),
      hero: rect(hero),
      adapter: rect(adapter),
      fallback: rect(fallback),
      guideRun: rect(guideRun),
      fallbackVisible: Boolean(fallback?.checkVisibility()),
      fallbackAlt: fallback?.alt ?? null,
      fallbackCopy: rect(fallbackCopy),
      fallbackCopyText: rect(fallbackCopy?.querySelector('p')),
      shadowFrame: rect(adapter?.shadowRoot?.querySelector('[part="frame"]')),
      shadowCopy: rect(adapter?.shadowRoot?.querySelector('.copy')),
      shadowCopyText: rect(adapter?.shadowRoot?.querySelector('.copy p')),
    };
  });
}

async function emtGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rect = (element: Element | null | undefined): Rect => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: window.innerHeight,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      navigation: rect(document.querySelector('nav[aria-label="Main navigation"]')),
      curriculum: rect(document.querySelector('.curriculum-tracks')),
      studyFallback: rect(document.querySelector('.emt-study-loading')),
      study: rect(document.querySelector('.emt-study')),
      footer: rect(document.querySelector('.footer')),
    };
  });
}

async function capture(
  page: import('@playwright/test').Page,
  testInfo: import('@playwright/test').TestInfo,
  width: number,
  stage: string,
) {
  const metrics = await geometry(page);
  await testInfo.attach(`responsive-20261028-${width}-${stage}.json`, {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: 'application/json',
  });
  const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await testInfo.attach(`responsive-20261028-${width}-${stage}.png`, {
    body: screenshot,
    contentType: 'image/png',
  });
  const destination = process.env.RESPONSIVE_SCREENSHOT_DIR;
  if (destination) {
    mkdirSync(resolve(destination), { recursive: true });
    writeFileSync(
      resolve(destination, `responsive-20261028-${width}-${stage}.json`),
      JSON.stringify(metrics, null, 2),
    );
    await page.screenshot({
      path: resolve(destination, `responsive-20261028-${width}-${stage}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
  return metrics;
}

for (const width of [320, 1366]) {
  test(`responsive-20261028 home hero stays stable while its host and shadow CSS are delayed at ${width}px`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(45000);
    const context = await browser.newContext({
      viewport: { width, height: width === 320 ? 740 : 768 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    let releaseCss!: () => void;
    let releaseAdapter!: () => void;
    let markHostRequested!: () => void;
    let markEmbedRequested!: () => void;
    let markAdapterRequested!: () => void;
    const cssGate = new Promise<void>((resolveGate) => {
      releaseCss = resolveGate;
    });
    const hostRequested = new Promise<void>((resolveRequest) => {
      markHostRequested = resolveRequest;
    });
    const embedRequested = new Promise<void>((resolveRequest) => {
      markEmbedRequested = resolveRequest;
    });
    const adapterGate = new Promise<void>((resolveGate) => {
      releaseAdapter = resolveGate;
    });
    const adapterRequested = new Promise<void>((resolveRequest) => {
      markAdapterRequested = resolveRequest;
    });
    try {
      await page.route('**/khan-grid-hero.js', async (route) => {
        markAdapterRequested();
        await adapterGate;
        await route.continue();
      });
      await page.route('**/host.css', async (route) => {
        markHostRequested();
        await cssGate;
        await route.continue();
      });
      await page.route('**/embed.css', async (route) => {
        markEmbedRequested();
        await cssGate;
        await route.continue();
      });

      await page.goto(testInfo.project.use.baseURL as string, { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('heading', { name: 'How long will the battery last?' }),
      ).toBeVisible();
      const hero = page.getByTestId('engineering-hero');
      const fallback = hero.locator('.engineering-hero-fallback');
      await expect(fallback).toBeVisible();
      await expect(fallback).toHaveAttribute('alt', /illustrative electro-thermal/);
      await expect(hero.locator('.engineering-hero-summary')).toBeVisible();
      await expect(
        hero.getByText(/Physics → executable models → evidence → energy systems/),
      ).toBeVisible();
      const before = await capture(page, testInfo, width, 'fallback');

      await adapterRequested;
      releaseAdapter();
      await Promise.all([hostRequested, embedRequested]);
      await expect(hero.locator('khan-grid-hero')).toBeAttached();
      await page.waitForFunction(() => {
        const adapter = document.querySelector('khan-grid-hero');
        return Boolean(adapter?.shadowRoot?.querySelector('link[rel="stylesheet"]'));
      });
      const pending = await capture(page, testInfo, width, 'styles-pending');

      // The poster and its explanatory text must remain the visible, stable fallback
      // until the custom element's shadow stylesheet has loaded.
      expect(pending.fallbackVisible, 'fallback poster remains visible while CSS is delayed').toBe(
        true,
      );
      expect(
        pending.documentWidth,
        'document stays within the viewport while CSS is delayed',
      ).toBeLessThanOrEqual(width + 1);
      expect(pending.hero).not.toBeNull();
      expect(before.hero).not.toBeNull();
      expect(
        Math.abs(pending.hero!.y - before.hero!.y),
        'hero top remains stable while CSS is delayed',
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(pending.hero!.height - before.hero!.height),
        'hero height remains stable while CSS is delayed',
      ).toBeLessThanOrEqual(2);

      releaseCss();
      await page.waitForFunction(() => {
        const hostStyle = document.querySelector<HTMLLinkElement>(
          'link[data-engineering-hero-host-style="true"]',
        );
        const embedStyle = document
          .querySelector('khan-grid-hero')
          ?.shadowRoot?.querySelector<HTMLLinkElement>('link[rel="stylesheet"]');
        return Boolean(hostStyle?.sheet?.cssRules.length && embedStyle?.sheet?.cssRules.length);
      });
      const enhanced = await capture(page, testInfo, width, 'enhanced');

      expect(
        enhanced.documentWidth,
        'enhanced hero does not cause horizontal page overflow',
      ).toBeLessThanOrEqual(width + 1);
      expect(enhanced.heading).not.toBeNull();
      expect(before.heading).not.toBeNull();
      expect(
        Math.abs(enhanced.heading!.y - before.heading!.y),
        'preceding experiment heading remains stable',
      ).toBeLessThanOrEqual(2);
      expect(enhanced.navigation).not.toBeNull();
      expect(before.navigation).not.toBeNull();
      expect(
        Math.abs(enhanced.navigation!.y - before.navigation!.y),
        'navigation remains stable during enhancement',
      ).toBeLessThanOrEqual(2);
      expect(enhanced.hero).not.toBeNull();
      expect(
        Math.abs(enhanced.hero!.x - before.hero!.x),
        'hero x geometry remains stable',
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(enhanced.hero!.y - before.hero!.y),
        'hero y geometry remains stable',
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(enhanced.hero!.width - before.hero!.width),
        'hero width remains stable',
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(enhanced.hero!.height - before.hero!.height),
        'hero height remains stable',
      ).toBeLessThanOrEqual(3);
      expect(before.fallbackCopyText).not.toBeNull();
      expect(enhanced.shadowCopyText).not.toBeNull();
      expect(
        Math.abs(enhanced.shadowCopyText!.x - before.fallbackCopyText!.x),
        'caption x position matches between poster and enhanced states',
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(enhanced.shadowCopyText!.y - before.fallbackCopyText!.y),
        'caption y position matches between poster and enhanced states',
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(enhanced.shadowCopyText!.width - before.fallbackCopyText!.width),
        'caption width matches between poster and enhanced states',
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(enhanced.shadowCopyText!.height - before.fallbackCopyText!.height),
        'caption height matches between poster and enhanced states',
      ).toBeLessThanOrEqual(2);
      await expect(hero.getByRole('button', { name: 'Play animation' })).toBeVisible();
      await expect(hero.getByText(/Illustrative telemetry; not live data/)).toBeVisible();
      await expect(hero.locator('khan-grid-hero .poster')).toBeVisible();

      const play = hero.getByRole('button', { name: 'Play animation' });
      await play.focus();
      await expect(play).toBeFocused();
      const focusVisible = await play.evaluate((button) => {
        const style = getComputedStyle(button);
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
      });
      expect(focusVisible, 'play control has a visible keyboard focus indicator').toBe(true);
    } finally {
      releaseAdapter?.();
      releaseCss?.();
      await context.close();
    }
  });
}

for (const width of [320, 1366]) {
  test(`responsive-20261028 EMT keeps curriculum and footer stable while the study is loading at ${width}px`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(45000);
    const viewport = { width, height: width === 320 ? 740 : 768 };
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    let releaseTracks!: () => void;
    let releaseStudy!: () => void;
    let markStudyRequested!: () => void;
    const tracksGate = new Promise<void>((resolveGate) => {
      releaseTracks = resolveGate;
    });
    const studyGate = new Promise<void>((resolveGate) => {
      releaseStudy = resolveGate;
    });
    const studyRequested = new Promise<void>((resolveRequest) => {
      markStudyRequested = resolveRequest;
    });
    try {
      await page.route('**/CurriculumTracks-*.js', async (route) => {
        await tracksGate;
        await route.continue();
      });
      await page.route('**/Study-*.js', async (route) => {
        markStudyRequested();
        await studyGate;
        await route.continue();
      });
      await page.goto(`${testInfo.project.use.baseURL}?mode=emt`, {
        waitUntil: 'domcontentloaded',
      });
      await studyRequested;
      await expect(page.getByText('Opening the transient study…', { exact: true })).toBeVisible();
      const loading = await emtGeometry(page);
      await testInfo.attach(`responsive-20261028-emt-${width}-loading.json`, {
        body: Buffer.from(JSON.stringify(loading, null, 2)),
        contentType: 'application/json',
      });
      const loadingScreenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
      await testInfo.attach(`responsive-20261028-emt-${width}-loading.png`, {
        body: loadingScreenshot,
        contentType: 'image/png',
      });
      const screenshotDirectory = process.env.RESPONSIVE_SCREENSHOT_DIR;
      if (screenshotDirectory) {
        mkdirSync(resolve(screenshotDirectory), { recursive: true });
        writeFileSync(
          resolve(screenshotDirectory, `responsive-20261028-emt-${width}-loading.json`),
          JSON.stringify(loading, null, 2),
        );
        await page.screenshot({
          path: resolve(screenshotDirectory, `responsive-20261028-emt-${width}-loading.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }

      expect(
        loading.curriculum,
        'curriculum is present while the heavier EMT module is loading',
      ).not.toBeNull();
      expect(
        loading.footer,
        'footer stays below the first viewport while the study loads',
      ).not.toBeNull();
      expect(loading.footer!.y).toBeGreaterThanOrEqual(viewport.height - 1);
      expect(loading.documentWidth).toBeLessThanOrEqual(width + 1);

      releaseTracks();
      releaseStudy();
      await expect(page.locator('.curriculum-tracks')).toBeVisible();
      await expect(page.locator('.emt-study')).toBeVisible();
      const loaded = await emtGeometry(page);
      const loadedScreenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
      await testInfo.attach(`responsive-20261028-emt-${width}-loaded.png`, {
        body: loadedScreenshot,
        contentType: 'image/png',
      });
      if (screenshotDirectory) {
        writeFileSync(
          resolve(screenshotDirectory, `responsive-20261028-emt-${width}-loaded.json`),
          JSON.stringify(loaded, null, 2),
        );
        await page.screenshot({
          path: resolve(screenshotDirectory, `responsive-20261028-emt-${width}-loaded.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
      expect(loaded.documentWidth).toBeLessThanOrEqual(width + 1);
      expect(loaded.footer!.y).toBeGreaterThanOrEqual(viewport.height - 1);
      expect(Math.abs(loaded.curriculum!.y - loading.curriculum!.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(loaded.curriculum!.height - loading.curriculum!.height)).toBeLessThanOrEqual(
        2,
      );
    } finally {
      releaseTracks?.();
      releaseStudy?.();
      await context.close();
    }
  });
}
