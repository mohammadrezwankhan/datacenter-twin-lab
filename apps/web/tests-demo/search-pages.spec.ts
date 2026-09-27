import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { lessons } from '../src/course-lessons';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import site from '../site.config.json' with { type: 'json' };

test('search pages legacy forwarding preserves lesson, query and fragment on the fixed host', async ({
  page,
}, testInfo) => {
  const legacy = 'https://mohammadrezwankhan.github.io/datacenter-twin-lab/';
  const output = testInfo.outputPath('legacy');
  execFileSync(
    process.env.TWIN_PYTHON || 'python',
    ['scripts/build_pages_redirect.py', '--site', '.local/browser-demo-site', '--output', output],
    { cwd: '../..' },
  );
  const document = await readFile(join(output, 'index.html'), 'utf8');
  await page.route(`${legacy}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: document }),
  );
  await page.route(`${site.url}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Destination</h1>' }),
  );
  for (const suffix of [
    '?lesson=ride-through#worked-answer',
    'learn/ride-through/?from=github#worked-answer',
    'https:example.com/?lesson=pue',
  ]) {
    await page.goto(legacy + suffix);
    await expect(page).toHaveURL(site.url + suffix);
  }
  const note = await readFile(join(output, 'learn/ride-through/index.html'), 'utf8');
  expect(note).toContain(`content="0;url=${site.url}learn/ride-through/"`);
});

test('search pages expose all twelve worked lessons with JavaScript disabled', async ({
  browser,
  baseURL,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    await page.goto('./');
    await page.getByRole('link', { name: 'Read all twelve course lessons' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Power Systems for Datacenter Engineers',
    );
    await expect(page.locator('.card')).toHaveCount(12);
    for (const lesson of lessons) {
      const response = await page.goto(`./learn/${lesson.id}/`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        lesson.title.replace(/^\d+\. /, ''),
      );
      await expect(page.locator('#worked-answer')).toContainText(lesson.explanation);
      await expect(page.locator('table').first()).toContainText(lesson.initial);
      await expect(page.locator('table').first()).toContainText(lesson.challenge);
      await expect(page.getByRole('link', { name: 'Run this browser lesson' })).toHaveAttribute(
        'href',
        `../../?lesson=${lesson.id}`,
      );
      // Inspect shipped bytes: local endpoint protection can inject its own browser scripts.
      const shipped = await readFile(
        new URL(
          '../../../.local/browser-demo-site/learn/' + lesson.id + '/index.html',
          import.meta.url,
        ),
        'utf8',
      );
      expect(shipped).not.toMatch(/<script\b[^>]*\bsrc=/i);
      const graph = JSON.parse(
        (await page.locator('script[type="application/ld+json"]').textContent())!,
      )['@graph'];
      expect(graph[0].description).toBe(lesson.question);
      expect(graph[0].author.name).toBe('Mohammad Rezwan Khan');
      expect(graph[0].learningResourceType).toBe('Lesson');
    }
    await page.goto('./about/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Understand the model. Reproduce the result.',
    );
    const manifest = await request.get('./data/evidence/v1.0.0/manifest.json');
    expect(manifest.status()).toBe(200);
    expect((await manifest.json()).engine_version).toBe('1.0.0');
  } finally {
    await context.close();
  }
});

test('search pages sitemap, canonical URLs and social metadata agree', async ({
  page,
  request,
}) => {
  const publicBase = process.env.VITE_PUBLIC_SITE_URL || site.url;
  const sitemap = await request.get('./sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1],
  );
  expect(new Set(urls).size).toBe(15);
  expect(urls.every((url) => url.startsWith(publicBase))).toBe(true);
  const robots = await request.get('./robots.txt');
  expect(await robots.text()).toContain(`Sitemap: ${publicBase}sitemap.xml`);
  expect(await robots.text()).not.toContain('Disallow: /');
  const titles = new Set<string>();
  for (const canonical of urls) {
    const relative = canonical.slice(publicBase.length);
    await page.goto(`./${relative}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    titles.add(await page.title());
    const linkedData = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent())!,
    );
    expect(linkedData['@context']).toBe('https://schema.org');
    expect(JSON.stringify(linkedData)).not.toMatch(/aggregateRating|award|reviewRating/);
  }
  expect(titles.size).toBe(15);
  const image = await request.get('./guide-preview.png');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');
});

test('search pages remain accessible, responsive and linked to live experiments', async ({
  page,
}) => {
  for (const path of ['learn/', 'learn/ride-through/', 'about/']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`./${path}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
  }
  await page.goto('./learn/ride-through/');
  await page.getByRole('link', { name: 'Run this browser lesson' }).click();
  await expect(page.getByLabel('Choose a lesson')).toHaveValue('ride-through');
  await expect(page.getByTestId('lesson-result')).toBeVisible();
});
