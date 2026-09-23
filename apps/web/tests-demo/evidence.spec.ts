import { expect, test } from '@playwright/test';
import { nativeRun } from './course-test-helpers';
import { ENGINE_VERSION } from '../src/js-engine/version';

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
