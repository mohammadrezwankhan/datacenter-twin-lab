import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { lessons } from '../src/course-lessons';
import { emtIntroduction } from '../seo-emt';
import { researchStudies } from '../seo-research';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('search pages discovery manifest and cards preserve the 12/1/5 records in source order', async ({
  page,
  request,
}) => {
  const response = await request.get('./learn/manifest.json');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  const expectedIds = [...lessons.map(({ id }) => id), 'emt', ...researchStudies.map(([id]) => id)];

  expect(manifest.counts).toEqual({ continuity: 12, emt: 1, dynamics: 5 });
  expect(manifest.items).toHaveLength(18);
  expect(manifest.items.map((item: { id: string }) => item.id)).toEqual(expectedIds);
  expect(manifest.sourceTextNormalization).toBe('UTF-8, CRLF normalized to LF');

  await page.goto('./learn/');
  await expect(page.locator('.learning-card')).toHaveCount(18);
  const cardIds = await page
    .locator('.learning-card')
    .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-learning-id')));
  expect(cardIds).toEqual(expectedIds);
  await expect(page.locator('#learning-library .section-heading > p')).toContainText(
    '12 continuity lessons · 1 EMT study · 5 advanced studies.',
  );

  for (const item of manifest.items) {
    const card = page.locator(`.learning-card[data-learning-id="${item.id}"]`);
    await expect(card.locator('h4 a')).toHaveText(item.title);
    if (item.question) await expect(card.locator('p').first()).toHaveText(item.question);
    await expect(card.locator('.card-description')).toHaveText(item.description);
    await expect(card.locator('.card-links a').first()).toHaveAttribute(
      'href',
      `..${item.overviewPath}`,
    );
    await expect(card.locator('.card-links a').nth(1)).toHaveAttribute(
      'href',
      `..${item.runtimePath}`,
    );
  }

  for (const [index, lesson] of lessons.entries()) {
    expect(manifest.items[index].title).toBe(lesson.title.replace(/^\d+\. /, ''));
    expect(manifest.items[index].description).toBe(lesson.concept);
    expect(manifest.items[index].question).toBe(lesson.question);
    expect(manifest.items[index].sequence).toBe(index + 1);
  }
  const emt = manifest.items[12];
  expect(emt.title).toBe(emtIntroduction.title);
  expect(emt.description).toBe(emtIntroduction.description);
  expect(emt.runtimePath).toBe('/?mode=emt');
  for (const [index, [id, title, question, description]] of researchStudies.entries()) {
    const item = manifest.items[index + 13];
    expect(item).toMatchObject({
      id,
      title,
      question,
      description,
      sequence: index + 1,
      overviewPath: '/studies/power-dynamics/',
      runtimePath: `/?study=${id}`,
      sharedOverview: true,
    });
  }
});

test('search pages discovery cards remain readable and linked with JavaScript disabled', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    await page.goto('./learn/');
    await expect(page.locator('.learning-card')).toHaveCount(18);
    await expect(page.locator('.learn-search')).toBeHidden();
    for (const lesson of lessons) {
      const card = page.locator(`.learning-card[data-learning-id="${lesson.id}"]`);
      await expect(card.locator('h4 a')).toHaveAttribute('href', `../learn/${lesson.id}/`);
      await expect(card.locator('.card-links a').nth(1)).toHaveAttribute(
        'href',
        `../?lesson=${lesson.id}`,
      );
    }
    for (const [id, , ,] of researchStudies) {
      const card = page.locator(`.learning-card[data-learning-id="${id}"]`);
      await expect(card.locator('h4 a')).toHaveAttribute('href', '../studies/power-dynamics/');
      await expect(card.locator('.card-links a').nth(1)).toHaveAttribute('href', `../?study=${id}`);
    }
    const emt = page.locator('.learning-card[data-learning-id="emt"]');
    await expect(emt.locator('h4 a')).toHaveAttribute('href', '../studies/emt/');
    await expect(emt.locator('.card-links a').nth(1)).toHaveAttribute('href', '../?mode=emt');
  } finally {
    await context.close();
  }
});

test('search pages discovery filters, clear, malformed queries and history restore correctly', async ({
  page,
}) => {
  await page.goto('./learn/');
  const search = page.getByRole('searchbox', { name: 'Search a topic or question' });

  await search.fill('load');
  await expect(page).toHaveURL(/q=load/);
  const continuityMatches = await page
    .locator('.learning-card[data-kind="continuity"]')
    .evaluateAll(
      (cards) => cards.filter((card) => card.getAttribute('data-search')?.includes('load')).length,
    );
  await page.getByRole('button', { name: 'Continuity', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('path')).toBe('continuity');
  await expect(page.locator('.learning-card:visible')).toHaveCount(continuityMatches);

  const dynamicsMatches = await page
    .locator('.learning-card[data-kind="dynamics"]')
    .evaluateAll(
      (cards) => cards.filter((card) => card.getAttribute('data-search')?.includes('load')).length,
    );
  await page.getByRole('button', { name: 'Power dynamics', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('path')).toBe('dynamics');
  await expect(page.locator('.learning-card:visible')).toHaveCount(dynamicsMatches);

  await page.goBack();
  await expect(page.getByRole('button', { name: 'Continuity', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(new URL(page.url()).searchParams.get('q')).toBe('load');
  await expect(page.locator('.learning-card:visible')).toHaveCount(continuityMatches);
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Power dynamics', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.learning-card:visible')).toHaveCount(dynamicsMatches);

  await search.fill('no-such-subject-xyz');
  await expect(page.locator('.learn-empty')).toBeVisible();
  await expect(page.locator('#learning-count')).toHaveText('0 of 18 learning items shown');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.learning-card:visible')).toHaveCount(18);
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
  expect(new URL(page.url()).searchParams.has('path')).toBe(false);
  await page.goBack();
  await expect(page.locator('.learn-empty')).toBeVisible();
  await page.goForward();
  await expect(page.locator('.learning-card:visible')).toHaveCount(18);

  const hostileQuery = '<img src=x onerror=alert(1)>';
  await page.goto(`./learn/?path=invalid&q=${encodeURIComponent(hostileQuery)}`);
  await expect(search).toHaveValue(hostileQuery);
  await expect(page.getByRole('button', { name: 'All paths', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[onerror]')).toHaveCount(0);
  await expect(page.locator('.learn-empty')).toBeVisible();
});

test('search pages discovery loads no React or scientific runtime and stays under gzip budget', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('./learn/');
  await page.waitForLoadState('networkidle');

  expect(
    requests.filter((url) =>
      /react|pyodide|engine\.zip|engine-manifest|\.wasm\b|\/api\//i.test(url),
    ),
  ).toEqual([]);
  const scripts = await page
    .locator('script[src]')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src));
  expect(scripts).toHaveLength(1);
  expect(new URL(scripts[0]).pathname).toMatch(/learn-discovery-[\w-]+\.js$/);

  const artifactRoot = resolve(repositoryRoot, '.local/browser-demo-site');
  const html = await readFile(resolve(artifactRoot, 'learn/index.html'), 'utf8');
  const src = html.match(/<script type="module" src="([^"]*learn-discovery[^"]+)"><\/script>/)?.[1];
  expect(src).toBeTruthy();
  const scriptPath = resolve(artifactRoot, 'learn', src!);
  const compressedBytes = gzipSync(await readFile(scriptPath)).byteLength;
  expect(compressedBytes).toBeLessThan(35 * 1024);
});

test('search pages discovery keeps native details and four model lenses', async ({ page }) => {
  await page.goto('./learn/');
  const picker = page.getByLabel('Diagram model');
  await expect(picker).toBeVisible();
  await expect(picker.locator('option')).toHaveText(['Continuity', 'EMT', 'Power dynamics']);

  for (const id of ['continuity', 'emt', 'dynamics']) {
    await picker.selectOption(id);
    const model = page.locator(`.model-explainer[data-model="${id}"]`);
    await expect(model).toBeVisible();
    await expect(model.locator('details')).toHaveCount(4);
    await expect(model.locator('summary')).toHaveText([
      '01 Physical',
      '02 Model',
      '03 Verification',
      '04 Decision',
    ]);
  }

  await picker.selectOption('continuity');
  const lenses = page.locator('.model-explainer[data-model="continuity"] details');
  await expect(lenses.first()).toHaveAttribute('open', '');
  await lenses.first().locator('summary').click();
  await expect(lenses.first()).not.toHaveAttribute('open', '');
  await lenses.nth(1).locator('summary').click();
  await expect(lenses.nth(1)).toHaveAttribute('open', '');
});

test('search pages discovery replays once, pauses, resets and respects motion and forced colors', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' });
  await page.goto('./learn/');
  const model = page.locator('.model-explainer[data-model="continuity"]');
  const stage = model.locator('.diagram-stage');
  const replay = model.getByRole('button', { name: 'Replay flow' });
  const pause = model.getByRole('button', { name: 'Pause flow' });

  await model.getByRole('button', { name: 'Rotate view' }).click();
  await expect(stage).toHaveClass(/is-rotated/);
  await replay.click();
  await expect(model).toHaveClass(/flow-playing/);
  expect(
    await stage
      .locator('.diagram-flow')
      .evaluate((path) => getComputedStyle(path).animationIterationCount),
  ).toBe('1');
  await expect(model).not.toHaveClass(/flow-playing/, { timeout: 5000 });
  await expect(model.locator('.flow-status')).toContainText('Static diagram.');

  await replay.click();
  await expect(model).toHaveClass(/flow-playing/);
  await pause.click();
  await expect(model).toHaveClass(/flow-paused/);
  await expect(model.getByRole('button', { name: 'Resume flow' })).toBeEnabled();
  await model.getByRole('button', { name: 'Resume flow' }).click();
  await expect(model).not.toHaveClass(/flow-paused/);
  await model.getByRole('button', { name: 'Reset view' }).click();
  await expect(stage).not.toHaveClass(/is-rotated/);
  await expect(model).not.toHaveClass(/flow-playing|flow-paused/);
  await expect(model.getByRole('button', { name: 'Pause flow' })).toBeDisabled();

  await replay.click();
  await expect(model).toHaveClass(/flow-playing/);
  await pause.click();
  await expect(model).toHaveClass(/flow-paused/);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(model).not.toHaveClass(/flow-playing|flow-paused/, { timeout: 5000 });
  await expect(model.locator('.flow-status')).toContainText('Static diagram.');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(replay).toBeDisabled();
  expect(await stage.locator('svg').evaluate((svg) => getComputedStyle(svg).transform)).toBe(
    'none',
  );
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  expect(
    await stage
      .locator('.node-face')
      .first()
      .evaluate((node) => getComputedStyle(node).stroke),
  ).not.toBe('none');
});

test('search pages discovery fits target widths, 48px controls and axe WCAG 2.2 AA', async ({
  page,
}) => {
  await page.goto('./learn/');
  for (const width of [320, 360, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `document must not overflow at ${width}px`,
    ).toBe(true);
    const shortTargets = await page
      .locator(
        '.learn-search input, .path-filters button, .search-footer button, .model-picker select, .diagram-controls button, .card-links a, .learning-paths > a, .model-lenses summary, .explorer-links a',
      )
      .evaluateAll((elements) =>
        elements
          .filter(
            (element) =>
              element.getClientRects().length > 0 && element.getBoundingClientRect().height < 48,
          )
          .map((element) => ({
            text: element.textContent?.trim(),
            height: element.getBoundingClientRect().height,
          })),
      );
    expect(shortTargets, `primary controls must be at least 48px at ${width}px`).toEqual([]);

    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations, `axe WCAG 2.2 AA at ${width}px`).toEqual([]);
  }
});
