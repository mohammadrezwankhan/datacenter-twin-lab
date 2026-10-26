import { expect, test } from '@playwright/test';
import { nativeRun } from './course-test-helpers';
import { ENGINE_VERSION } from '../src/js-engine/version';

test('evidence navigation distinguishes versioned source from published releases', async ({
  page,
  request,
}) => {
  const repository = 'https://github.com/mohammadrezwankhan/datacenter-twin-lab';
  await page.goto('./?mode=evidence');
  await expect(
    page.getByRole('link', { name: `Versioned source v${ENGINE_VERSION}`, exact: false }),
  ).toHaveAttribute('href', `${repository}/tree/v${ENGINE_VERSION}`, { timeout: 3000 });
  await expect(
    page.getByRole('link', { name: 'Published releases', exact: false }),
  ).toHaveAttribute('href', `${repository}/releases`, { timeout: 3000 });
  for (const path of ['about/', 'evidence/']) {
    const response = await request.get(`./${path}`);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).not.toContain(`${repository}/releases/tag/v${ENGINE_VERSION}`);
    expect(html).toContain(`${repository}/releases`);
    expect(html).toContain(
      path === 'about/'
        ? `${repository}/tree/v${ENGINE_VERSION}`
        : `${repository}/archive/refs/tags/v${ENGINE_VERSION}.zip`,
    );
  }
});

test('evidence hub exposes three complete native-equal cases, reports and captions', async ({
  page,
  request,
}) => {
  const indexResponse = await request.get('./evidence-index.json');
  expect(indexResponse.ok()).toBe(true);
  const index = await indexResponse.json();
  expect(index.version).toBe(ENGINE_VERSION);
  expect(index.cases).toHaveLength(3);
  await page.goto('./?mode=evidence');
  await expect(page.locator('.proof-case')).toHaveCount(3);
  for (const item of index.cases) {
    const response = await request.get(`./${item.run_path}`);
    expect(response.ok()).toBe(true);
    const run = await response.json();
    expect(run.input_sha256).toBe(item.input_sha256);
    expect(run.run_id).toBe(item.run_id);
    expect(run).toEqual(nativeRun(run));
    const report = await request.get(`./${item.report_path}`);
    expect(report.ok()).toBe(true);
    expect(await report.text()).toContain(item.input_sha256);
  }
  const video = page.locator('video');
  await expect(video).toHaveAttribute('preload', 'none');
  await expect(video.locator('track')).toHaveAttribute('kind', 'captions');
  const captions = await request.get('./proof-demo.vtt');
  expect(captions.ok()).toBe(true);
  expect(await captions.text()).toContain('WEBVTT');
  const clip = await request.get('./proof-demo.webm');
  expect(clip.headers()['content-type']).toContain('video/webm');
  expect((await clip.body()).length).toBeGreaterThan(10000);
  await page.reload();
  await expect(page.locator('.proof-case')).toHaveCount(3);
  await page.getByRole('button', { name: 'Start here', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('guide-run')).toBeVisible();
});
