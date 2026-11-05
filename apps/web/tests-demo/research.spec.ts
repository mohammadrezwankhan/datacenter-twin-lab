import { requiredPresent } from '../src/required-value';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type { ResearchResult } from '../src/research/types';
import { arrayValue, jsonObject, objectValue, stringValue } from './json-contracts';
import { researchResultValue } from './research-contract';

function native(result: ResearchResult): unknown {
  const output: unknown = JSON.parse(
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
  return output;
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
    a.forEach((value, i) => {
      compare(value, b[i], `${path}[${String(i)}]`);
    });
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

test('power dynamics runtime versions match the selected Pyodide lock', async ({
  page,
  context,
  baseURL,
}, info) => {
  // Use the same locally staged runtime as the application. No CDN fallback can
  // conceal a missing wheel or a package imported from the wrong distribution.
  const allowedOrigin = `${new URL(requiredPresent(baseURL, 'baseURL')).origin}/`;
  await context.route('**/*', (route) =>
    route.request().url().startsWith(allowedOrigin) ? route.continue() : route.abort(),
  );
  await page.goto('./?study=load-step');
  const expected = stringValue(
    objectValue(jsonObject(await readFile('package.json', 'utf8')).devDependencies).pyodide,
  );
  const versions = await page.evaluate(async () => {
    const base = new URL('./', location.href);
    const runtime = new URL('pyodide/', base).href;
    const fetchJson = async (url: string | URL): Promise<unknown> => {
      const response = await fetch(url);
      const value: unknown = await response.json();
      return value;
    };
    const [lock, engine, research] = await Promise.all([
      fetchJson(`${runtime}pyodide-lock.json`),
      fetchJson(new URL('engine-manifest.json', base)),
      fetchJson(new URL('research-manifest.json', base)),
    ]);
    const module: unknown = await import(`${runtime}pyodide.mjs`);
    if (
      module === null ||
      typeof module !== 'object' ||
      !('loadPyodide' in module) ||
      typeof module.loadPyodide !== 'function'
    ) {
      throw new TypeError('The staged runtime must provide loadPyodide');
    }
    const loadPyodide = module.loadPyodide as (options: { indexURL: string }) => unknown;
    const loaded: unknown = await loadPyodide({ indexURL: runtime });
    type Runtime = {
      version: string;
      loadPackage: (names: string[]) => unknown;
      runPython: (source: string) => unknown;
    };
    if (
      loaded === null ||
      typeof loaded !== 'object' ||
      !('version' in loaded) ||
      typeof loaded.version !== 'string' ||
      !('loadPackage' in loaded) ||
      typeof loaded.loadPackage !== 'function' ||
      !('runPython' in loaded) ||
      typeof loaded.runPython !== 'function'
    ) {
      throw new TypeError('The staged runtime must provide version, loadPackage, and runPython');
    }
    const py = loaded as Runtime;
    await py.loadPackage(['numpy', 'scipy']);
    const serialized = py.runPython(
      'import json,numpy,scipy\njson.dumps({"numpy":numpy.__version__,"scipy":scipy.__version__})',
    );
    if (typeof serialized !== 'string')
      throw new TypeError('Python version metadata must be JSON text');
    const imported: unknown = JSON.parse(serialized);
    return { loaded: py.version, lock, engine, research, imported };
  });
  expect(versions.loaded).toBe(expected);
  expect(objectValue(versions.engine).pyodide_version).toBe(expected);
  const packages = objectValue(objectValue(versions.lock).packages);
  const imported = objectValue(versions.imported);
  const runtime = arrayValue(objectValue(versions.research).runtime);
  for (const name of ['numpy', 'scipy']) {
    const locked = objectValue(packages[name]);
    expect(stringValue(imported[name])).toBe(stringValue(locked.version));
    expect(runtime).toContainEqual(
      expect.objectContaining({
        name,
        version: stringValue(locked.version),
        sha256: stringValue(locked.sha256),
      }),
    );
  }
  await info.attach('loaded-runtime-versions.json', {
    body: Buffer.from(
      JSON.stringify({ pyodide: versions.loaded, imported: versions.imported }, null, 2),
    ),
    contentType: 'application/json',
  });
});

test('load-step rejects equal or decreasing loads before downloading the runtime', async ({
  page,
}) => {
  const runtimeRequests: string[] = [];
  page.on('request', (request) => {
    if (/pyodide|\.whl|research\.zip/.test(request.url())) runtimeRequests.push(request.url());
  });
  await page.goto('./?study=load-step');
  const initial = page.getByTestId('research-input-load_initial_pu');
  const final = page.getByTestId('research-input-load_final_pu');
  const run = page.getByTestId('research-run');
  await initial.fill('0.6');
  for (const value of ['0.6', '0.4']) {
    await final.fill(value);
    await expect(run).toBeDisabled({ timeout: 3000 });
    await expect(
      page.getByText('Final load must exceed initial load', { exact: false }),
    ).toBeVisible();
    await expect(initial).toHaveValue('0.6');
    await expect(final).toHaveValue(value);
  }
  for (const [before, after] of [
    ['0.3', '0.4'],
    ['0.7', '0.8'],
  ] as const) {
    await initial.fill(before);
    await final.fill(after);
    await expect(run).toBeEnabled();
    await expect(
      page.getByText('Final load must exceed initial load', { exact: false }),
    ).toHaveCount(0);
  }
  expect(runtimeRequests).toEqual([]);
});

for (const id of ['load-step', 'modal', 'forced-response', 'model-comparison', 'grid-network']) {
  test(`power dynamics ${id} runs locally and matches native numerical outputs`, async ({
    page,
    baseURL,
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
    const predictions = page
      .getByRole('group', { name: '01 · Predict before the run', exact: true })
      .getByRole('radio');
    await predictions.nth(0).check();
    await page.getByTestId('research-run').click();
    await expect(page.getByTestId('research-export-json')).toBeVisible();
    await expect(page.getByText('Applied result', { exact: true })).toBeVisible();
    await expect(page.getByText('Draft changed.', { exact: true })).not.toBeVisible();
    await predictions.nth(1).check();
    await expect(page.getByText('Showing prior applied run', { exact: true })).toBeVisible();
    await predictions.nth(0).check();
    await expect(page.getByText('Applied result', { exact: true })).toBeVisible();
    const pending = page.waitForEvent('download');
    await page.getByTestId('research-export-json').click();
    const result = researchResultValue(
      jsonObject(await readFile(await (await pending).path(), 'utf8')),
    );
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
        .every((url) => url.startsWith(`${new URL(requiredPresent(baseURL, 'baseURL')).origin}/`)),
    ).toBe(true);
    const csv = page.waitForEvent('download');
    await page.getByTestId('research-export-csv').click();
    const text = await readFile(await (await csv).path(), 'utf8');
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
  await page.getByTestId('research-input-load_initial_pu').fill('0.6');
  await expect(page.getByTestId('research-run')).toBeDisabled({ timeout: 3000 });
  await expect(page.getByText('Showing prior applied run', { exact: true })).toBeVisible();
  const priorDownload = page.waitForEvent('download');
  await page.getByTestId('research-export-json').click();
  const prior = researchResultValue(
    jsonObject(await readFile(await (await priorDownload).path(), 'utf8')),
  );
  expect(prior.config.load_initial_pu).toBe(0.5);
  expect(prior.config.load_final_pu).toBe(0.6);
  await page.getByTestId('research-input-load_initial_pu').fill('0.5');
  await page.getByTestId('research-input-dc_capacitance_pu').fill('0');
  await expect(page.getByTestId('research-run')).toBeDisabled();
  const pending = page.waitForEvent('download');
  await page.getByTestId('research-export-json').click();
  const result = researchResultValue(
    jsonObject(await readFile(await (await pending).path(), 'utf8')),
  );
  expect(result.config.dc_capacitance_pu).toBe(2);
  await page.getByTestId('research-input-dc_capacitance_pu').fill('3');
  await page.getByTestId('research-run').click();
  await expect(page.getByTestId('research-results')).toContainText('Applied result');
  await expect(page.getByTestId('research-run')).toBeEnabled();
  const changed = page.waitForEvent('download');
  await page.getByTestId('research-export-json').click();
  const updated = researchResultValue(
    jsonObject(await readFile(await (await changed).path(), 'utf8')),
  );
  expect(updated.config.dc_capacitance_pu).toBe(3);
  compare(updated, native(updated));
});
