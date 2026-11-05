import { continuityValue, jsonObject, arrayValue, stringValue } from './json-contracts';
/** Exercised public presets must reproduce the native Python engine byte-for-field.
 * The original course.spec.ts already covers 12 x 2 continuity lesson runs.
 */
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { nativeRun } from './course-test-helpers';

test('all 18 published continuity presets export native-equal runs', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?mode=advanced');
  const selector = page.getByLabel('Scenario', { exact: true });
  await expect(selector).toBeVisible();
  await expect(page.getByTestId('run-id')).toBeVisible();
  const options = await selector.locator('option').evaluateAll((nodes) =>
    nodes
      .filter((node) => !(node as HTMLOptionElement).disabled)
      .map((node) => ({
        id: (node as HTMLOptionElement).value,
        label: (node as HTMLOptionElement).textContent.trim(),
      }))
      .filter(({ id }) => id !== ''),
  );
  const ids = options.map(({ id }) => id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(options, 'Expected precisely the 18 documented standard scenarios').toHaveLength(18);
  const observed: Record<string, string>[] = [];
  for (const preset of options) {
    const oldRunId = await page.getByTestId('run-id').textContent();
    const selected = await selector.inputValue();
    if (preset.id !== selected) {
      await selector.selectOption(preset.id);
      await expect
        .poll(() => page.getByTestId('run-id').textContent(), { timeout: 45_000 })
        .not.toBe(oldRunId);
    }
    const downloadPending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export run' }).click();
    const file = await downloadPending;
    const path = await file.path();
    if (!path) throw new Error(`Missing downloaded run for ${preset.id}`);
    const browserRun = continuityValue(jsonObject(await readFile(path, 'utf8')));
    expect(browserRun.scenario.id, `Preset ${preset.id} has no source ID`).toMatch(/\S/);
    expect(browserRun.input_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(browserRun, `Browser-Python mismatch for ${preset.id}`).toEqual(nativeRun(browserRun));
    expect(browserRun.summary.energy_balance_residual_kwh).toBe('0');
    observed.push({
      preset: preset.id,
      inputSHA256: stringValue(browserRun.input_sha256),
      runId: stringValue(browserRun.run_id),
      intervals: String(arrayValue(browserRun.intervals).length),
      verification: 'exact Python parity',
    });
  }
  await testInfo.attach('all-preset-python-parity', {
    body: JSON.stringify({ measuredAt: new Date().toISOString(), observed, errors }, null, 2),
    contentType: 'application/json',
  });
  expect(errors).toEqual([]);
});
