import { jsonObject, objectValue } from './json-contracts';
import { requiredPresent } from '../src/required-value';
/** Expand coverage beyond the original 12 native-equal continuity lessons.
 * Infrastructure educational screens are a separate result family and must
 * retain their explicit engineering HOLD; do not assert Python parity here.
 */
import { expect, test } from '@playwright/test';
import { courseCatalog } from '../src/curriculum';

const lessons = courseCatalog.filter((item) => item.renderer === 'infrastructure');

test('curriculum inventory has 12 continuity and 12 infrastructure lessons', () => {
  expect(courseCatalog).toHaveLength(24);
  expect(lessons).toHaveLength(12);
});

for (const lesson of lessons) {
  test(`${String(lesson.number)}: ${lesson.id} default, challenge, evidence HOLD and exported envelope`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`./?lesson=${encodeURIComponent(lesson.id)}`);
    const studio = page.getByTestId('infrastructure-course');
    await expect(studio).toBeVisible();
    await expect(studio).toHaveAttribute('data-lesson', lesson.id);
    await expect(studio.locator('.infra-assessment')).toHaveCount(3);
    await expect(studio.locator('.infra-hold')).toContainText('Engineering HOLD');
    const status = page.getByTestId('infrastructure-run-state');
    await expect(status).toContainText('No completed result');
    const runButton = studio.getByRole('button', { name: 'Run screen' });
    await runButton.click();
    await expect(status).toContainText('Completed case.');
    const result = studio
      .locator('table')
      .filter({ has: page.locator('caption', { hasText: 'Last completed educational screen' }) });
    await expect(result).toBeVisible();
    const before = await studio
      .locator('details')
      .filter({ has: page.getByText('Inspect applied inputs and hashes') })
      .locator('pre')
      .textContent();
    expect(before).not.toBeNull();
    const baselineHash = objectValue(
      jsonObject(requiredPresent(before, 'before')).result,
    ).inputHash;
    await studio.getByRole('button', { name: 'Apply challenge' }).click();
    await expect(status).toContainText('Inputs changed');
    await runButton.click();
    await expect(status).toContainText('Completed case.');
    const exportButton = studio.getByRole('button', { name: 'Export completed screen' });
    await expect(exportButton).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
    expect(download.suggestedFilename()).toMatch(/^infrastructure-[\w-]+-[0-9a-f]{12}\.json$/);
    const blob = jsonObject(
      await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'),
    );
    expect(blob.exportSchema).toBe('infrastructure-lesson-export-1');
    expect(blob.engineeringDecision).toBe('HOLD');
    expect(blob.independentEngineeringVerification).toBe(false);
    expect(objectValue(blob.result).inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(
      objectValue(blob.result).inputHash,
      'Challenge must change the applied model inputs',
    ).not.toBe(baselineHash);
    expect(objectValue(blob.result).outputs).toBeDefined();
    await testInfo.attach(`infra-${lesson.id}-metadata`, {
      body: JSON.stringify(
        {
          lessonId: lesson.id,
          exportedFilename: download.suggestedFilename(),
          inputHash: objectValue(blob.result).inputHash,
          engineeringDecision: blob.engineeringDecision,
          pageErrors,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    expect(pageErrors).toEqual([]);
  });
}
