import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { lessons } from '../src/course-lessons';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import site from '../site.config.json' with { type: 'json' };
import { nativeRun } from './course-test-helpers';

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
  expect(await readFile(join(output, 'guide-preview.png'))).toEqual(
    await readFile(new URL('../../../.local/browser-demo-site/guide-preview.png', import.meta.url)),
  );
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
  expect(new Set(urls).size).toBe(18);
  expect(urls.every((url) => url.startsWith(publicBase))).toBe(true);
  const robots = await request.get('./robots.txt');
  expect(await robots.text()).toContain(`Sitemap: ${publicBase}sitemap.xml`);
  expect(await robots.text()).not.toContain('Disallow: /');
  const titles = new Set<string>();
  for (const canonical of urls) {
    const relative = canonical.slice(publicBase.length);
    await page.goto(`./${relative}`);
    const verification = page.locator('meta[name="google-site-verification"]');
    if (site.googleSiteVerification && !relative && publicBase === site.url)
      await expect(verification).toHaveAttribute('content', site.googleSiteVerification);
    else await expect(verification).toHaveCount(0);
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
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      'content',
      '1280',
    );
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
      'content',
      '900',
    );
    expect(JSON.stringify(linkedData)).toContain(`${publicBase}about/#author`);
  }
  expect(titles.size).toBe(18);
  const image = await request.get('./guide-preview.png');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');
});

test('search pages remain accessible, responsive and linked to live experiments', async ({
  page,
}) => {
  for (const path of [
    'learn/',
    ...lessons.map((lesson) => `learn/${lesson.id}/`),
    'evidence/',
    'about/',
    'studies/emt/',
    'studies/power-dynamics/',
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`./${path}`);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${path} must fit the viewport, including full-length source revision links`,
    ).toBe(true);
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

test('search pages result records reproduce all 24 native lesson calculations', async ({
  browser,
  baseURL,
  request,
}) => {
  const expectations = JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      [
        '-c',
        'import json,sys;sys.path.insert(0,"tests");from test_course_lessons import LESSON_CASES;print(json.dumps(LESSON_CASES))',
      ],
      { cwd: '../..', encoding: 'utf8' },
    ),
  );
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    for (const lesson of lessons) {
      const response = await request.get(`./learn/${lesson.id}/results.json`);
      expect(response.status()).toBe(200);
      const record = await response.json();
      expect(record.lesson_id).toBe(lesson.id);
      expect(record.result_unit).toBe(lesson.resultUnit);
      expect(record.records).toHaveLength(2);
      expect(record.source_revision).toMatch(/^(?:[a-f0-9]{40}|v1\.0\.0)$/);
      const expected = expectations.find((item: { id: string }) => item.id === lesson.id);
      await page.goto(`./learn/${lesson.id}/#worked-answer`);
      const cells = page.locator('#calculated-results [data-result]');
      for (const [index, row] of record.records.entries()) {
        expect(row.input).toBe(index ? lesson.challenge : lesson.initial);
        expect(row.calculation).toEqual(nativeRun(row.calculation));
        expect(Number(row.result)).toBeCloseTo(
          Number(index ? expected.expected_challenge : expected.expected_initial),
          7,
        );
        await expect(cells.nth(index)).toHaveAttribute('data-result', String(row.result));
        await expect(cells.nth(index)).toHaveText(
          new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(Number(row.result)),
        );
      }
      await expect(page.locator('#cite')).toContainText(`${site.url}learn/${lesson.id}/`);
      const graph = JSON.parse(
        (await page.locator('script[type="application/ld+json"]').textContent())!,
      )['@graph'];
      for (const citation of graph[0].citation) {
        await expect(page.locator(`a[href="${citation.url}"]`).first()).toBeVisible();
      }
    }
  } finally {
    await context.close();
  }
});

test('search pages evidence claims link to complete versioned records without JavaScript', async ({
  browser,
  baseURL,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    await page.goto('./');
    await page
      .getByRole('link', { name: 'Reference results and source records', exact: true })
      .click();
    await expect(page).toHaveURL(new URL('evidence/', baseURL!).href);
    await expect(page.locator('#quick-answer')).toContainText('307.8 seconds');
    await expect(page.locator('#quick-answer')).toContainText('153.9 seconds');
    await expect(page.locator('#quick-answer')).toContainText('607.8 s or 453.9 s elapsed');
    const index = await (await request.get('./evidence-index.json')).json();
    const table = page.getByRole('table');
    for (const item of index.cases) {
      const run = await (await request.get('./' + item.run_path)).json();
      expect(run).toEqual(nativeRun(run));
      await expect(page.locator('#' + item.id)).toContainText(item.outcome);
      const row = table.getByRole('row').filter({ hasText: item.title });
      for (const field of ['requested_it_kwh', 'served_it_kwh', 'unserved_it_kwh']) {
        await expect(row).toContainText(
          new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(
            Number(run.summary[field]),
          ),
        );
      }
    }
    const graph = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent())!,
    )['@graph'];
    const dataset = graph.find((item: { '@type': string }) => item['@type'] === 'Dataset');
    expect(dataset.distribution).toHaveLength(6);
    for (const item of dataset.distribution) {
      const relative = item.contentUrl.slice(site.url.length);
      expect((await request.get('./' + relative)).status()).toBe(200);
      await expect(page.locator(`a[href="../${relative}"]`)).toBeVisible();
    }
    await expect(page.locator('#cite')).toContainText(
      'No DOI or independent external reproduction is asserted',
    );
    const missingPage = await readFile(
      new URL('../../../.local/browser-demo-site/404.html', import.meta.url),
      'utf8',
    );
    expect(missingPage).toContain('content="noindex"');
    expect(await (await request.get('./sitemap.xml')).text()).not.toContain('404.html');
  } finally {
    await context.close();
  }
});
