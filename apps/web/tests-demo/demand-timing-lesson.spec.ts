import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { nativeRun } from './course-test-helpers';

test('equal-energy teaching inputs reproduce full native and optional Python results', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto('./?mode=advanced');
  await expect(page.getByTestId('served-power')).toBeVisible();
  await page.getByRole('button', { name: 'Import scenario', exact: true }).click();

  const cases = [
    { name: 'early-peak', shortfall: 487 / 6, depletion: ['607.8'] },
    { name: 'late-peak', shortfall: 0, depletion: [] },
    { name: 'shifted-peak', shortfall: 211 / 18, depletion: ['857.8'] },
  ];
  for (const { name, shortfall, depletion } of cases) {
    const bytes = await readFile(`../../docs/examples/demand-timing/${name}.json`);
    await page.getByLabel('Scenario JSON file (up to 10 MiB)').setInputFiles({
      name: `${name}.json`,
      mimeType: 'application/json',
      buffer: bytes,
    });
    await expect(page.getByTestId('scenario-file-preview')).toContainText('Ready to run');
    await page.getByRole('button', { name: 'Run imported scenario', exact: true }).click();
    await expect(page.getByTestId('scenario-file-preview')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Run scenario', exact: true })).toBeEnabled();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export run', exact: true }).click();
    const run = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
    expect(run.scenario).toEqual(JSON.parse(bytes.toString('utf8')));
    expect(run).toEqual(nativeRun(run));
    expect(run.summary.requested_it_kwh).toBe('375');
    expect(Number(run.summary.unserved_it_kwh)).toBeCloseTo(shortfall, 10);
    expect(
      run.events
        .filter((event: { action: string }) => event.action === 'battery_depleted')
        .map((event: { at_s: string }) => event.at_s),
    ).toEqual(depletion);

    await page.getByLabel('Verify against Python').check();
    await expect(page.getByTestId('python-verification-status')).toContainText(
      'Exact match with Python',
    );
    await page.getByLabel('Verify against Python').uncheck();
  }
  await page.getByRole('button', { name: 'Edit demand timeline', exact: true }).click();
  await expect(page.getByTestId('demand-preview-energy')).toContainText('375');
});
