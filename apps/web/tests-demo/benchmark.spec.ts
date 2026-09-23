import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { ENGINE_VERSION } from '../src/js-engine/version';

test('measure cold guide entry, first result and precomputed replay without claiming a service SLA', async ({
  browser,
}, testInfo) => {
  const samples = [];
  for (let index = 0; index < 3; index++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const assets: Promise<{ path: string; decoded_bytes: number }>[] = [];
    context.on('response', (response) => {
      if (response.url().startsWith('http://127.0.0.1:4174/'))
        assets.push(
          response.body().then((body) => ({
            path: new URL(response.url()).pathname,
            decoded_bytes: body.byteLength,
          })),
        );
    });
    const started = performance.now();
    await page.goto('http://127.0.0.1:4174/datacenter-twin-lab/');
    await expect(page.getByTestId('guide-run')).toBeVisible();
    const interactiveMs = performance.now() - started;
    await page.getByTestId('guide-prediction').fill('300');
    const calculationStarted = performance.now();
    await page.getByTestId('guide-run').click();
    await expect(page.getByTestId('guide-result')).toBeVisible();
    const clickToResultMs = performance.now() - calculationStarted;
    const resources = await Promise.all(assets);
    expect(
      resources.filter(({ path }) => /pyodide|engine\.zip|proof-demo|guide-.*png/.test(path)),
    ).toEqual([]);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export guided run (JSON)' }).click();
    const run = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
    samples.push({
      sample: index + 1,
      interactive_ms: interactiveMs,
      click_to_result_ms: clickToResultMs,
      decoded_response_bytes: resources.reduce((sum, item) => sum + item.decoded_bytes, 0),
      resources,
      input_sha256: run.input_sha256,
    });
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4174/datacenter-twin-lab/?preset=generator_failure');
  const slider = page.getByLabel('Replay interval', { exact: true });
  await expect(slider).toBeVisible();
  await slider.fill('0');
  const maximum = Number(await slider.getAttribute('max'));
  const replayStarted = performance.now();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(slider).toHaveValue(String(maximum));
  await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible();
  const replayMs = performance.now() - replayStarted;
  const result = {
    measured_at: new Date().toISOString(),
    engine_version: ENGINE_VERSION,
    environment: {
      browser: browser.version(),
      platform: process.platform,
      architecture: process.arch,
      viewport: '1280x900',
      origin: 'loopback Vite preview',
      throttling: 'none',
    },
    method:
      'Three isolated browser contexts; cold browser cache, potentially warm OS cache. Stopwatch includes Playwright navigation/click/assertion overhead. Bytes are decoded response bodies, including worker requests, not compressed wire bytes. Replay traverses precomputed intervals and is not simulation runtime.',
    guide_samples: samples,
    replay: {
      preset: 'generator_failure',
      intervals: maximum + 1,
      programmed_interval_ms: 120,
      programmed_total_ms_including_stop_tick: (maximum + 1) * 120,
      observed_ms_including_automation: replayMs,
    },
    claims:
      'Local observations only; no internet/mobile latency, scalability or physical controller response guarantee.',
  };
  const path = testInfo.outputPath('guide-benchmark.json');
  await writeFile(path, JSON.stringify(result, null, 2) + '\n');
  await testInfo.attach('guide-benchmark', { path, contentType: 'application/json' });
  await context.close();
});
