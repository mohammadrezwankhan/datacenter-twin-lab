import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type { ResearchResult } from '../src/research/types';

function native(result: ResearchResult): ResearchResult {
  return JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      [
        '-c',
        'import json,sys;from datacenter_twin.research import run_study;r=json.load(sys.stdin);print(json.dumps(run_study(r["study_id"],r["config"]),allow_nan=False))',
      ],
      {
        cwd: '../..',
        input: JSON.stringify(result),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        timeout: 90000,
      },
    ),
  );
}

// BLAS/compiler builds can change adaptive solver work counts. Compare the
// complete physical outputs and diagnostics with stated numerical tolerances;
// do not equate identical source with bitwise floating-point identity.
function compare(a: unknown, b: unknown, path = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    if (/\.(nfev|njev|nlu|integration_nfev|iterations|function_evaluations)$/.test(path)) {
      expect(Number.isFinite(a) && a >= 0).toBe(true);
      return;
    }
    expect(Math.abs(a - b), path).toBeLessThanOrEqual(2e-5 * Math.max(1, Math.abs(b)));
  } else if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, path).toBe(b.length);
    a.forEach((value, i) => compare(value, b[i], `${path}[${i}]`));
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(a).sort(), path).toEqual(Object.keys(b).sort());
    for (const key of Object.keys(a))
      compare(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
  } else expect(a, path).toEqual(b);
}

for (const id of ['load-step', 'modal', 'forced-response', 'model-comparison', 'grid-network']) {
  test(`power dynamics ${id} runs locally and matches native numerical outputs`, async ({
    page,
  }, info) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(`./?study=${id}`);
    await expect(page.getByTestId('research-studio')).toHaveAttribute('data-study', id);
    expect(requests.some((url) => /pyodide|\.whl|research\.zip/.test(url))).toBe(false);
    if (id === 'model-comparison') {
      const load = page.getByTestId('research-input-load_final_pu');
      await expect(load).toHaveAttribute('max', '0.6');
      await load.fill('0.61');
      await expect(page.getByTestId('research-run')).toBeDisabled();
      await load.fill('0.6');
    }
    await page.getByTestId('research-run').click();
    await expect(page.getByTestId('research-export-json')).toBeVisible();
    const pending = page.waitForEvent('download');
    await page.getByTestId('research-export-json').click();
    const result = JSON.parse(
      await readFile((await (await pending).path())!, 'utf8'),
    ) as ResearchResult;
    expect(result.study_id).toBe(id);
    const reference = native(result);
    // Preserve both complete results so compiled-runtime differences can be
    // diagnosed from CI evidence without rerunning or weakening comparisons.
    for (const [runtime, output] of Object.entries({ browser: result, native: reference })) {
      await info.attach(`${id}-${runtime}.json`, {
        body: Buffer.from(JSON.stringify(output, null, 2)),
        contentType: 'application/json',
      });
    }
    compare(result, reference);
    expect(
      requests
        .filter((url) => /\.whl/.test(url))
        .every((url) => url.startsWith('http://127.0.0.1:4174/')),
    ).toBe(true);
    const csv = page.waitForEvent('download');
    await page.getByTestId('research-export-csv').click();
    const text = await readFile((await (await csv).path())!, 'utf8');
    const points = result.charts.reduce(
      (sum, chart) => sum + chart.x.length * chart.lines.length,
      0,
    );
    expect(text.trim().split(/\r?\n/).length).toBe(points + 1);
    await page.screenshot({ path: info.outputPath(`research-${id}.png`), fullPage: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
    }
  });
}

test('power dynamics cancellation and invalid drafts preserve the applied result', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?study=load-step');
  await page.getByTestId('research-run').click();
  await page.getByTestId('research-cancel').click();
  await expect(page.getByTestId('research-results')).toContainText('No applied result yet');
  await page.getByTestId('research-run').click();
  await expect(page.getByTestId('research-export-json')).toBeVisible();
  await page.getByTestId('research-input-dc_capacitance_pu').fill('0');
  await expect(page.getByTestId('research-run')).toBeDisabled();
  const pending = page.waitForEvent('download');
  await page.getByTestId('research-export-json').click();
  const result = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(result.config.dc_capacitance_pu).toBe(2);
  await page.getByTestId('research-input-dc_capacitance_pu').fill('3');
  await page.getByTestId('research-run').click();
  await expect(page.getByTestId('research-results')).toContainText('Applied result');
  await expect(page.getByTestId('research-run')).toBeEnabled();
  const changed = page.waitForEvent('download');
  await page.getByTestId('research-export-json').click();
  const updated = JSON.parse(
    await readFile((await (await changed).path())!, 'utf8'),
  ) as ResearchResult;
  expect(updated.config.dc_capacitance_pu).toBe(3);
  compare(updated, native(updated));
});
