import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { compareEmt } from '../src/emt/engine';

test('EMT study exports applied inputs, preserves drafts and verifies every sample in Python', async ({
  page,
}, info) => {
  await page.goto('./?mode=emt');
  await expect(page.getByRole('heading', { name: 'Inside a voltage sag' })).toBeVisible();
  await expect(page.getByTestId('emt-results')).toContainText('178.95');
  await page.getByTestId('emt-capacitance_mf').fill('24');
  // Exports must remain the applied case until a new calculation is requested.
  for (const [run, expected] of [
    [false, 12],
    [true, 24],
  ] as const) {
    if (run) await page.getByTestId('emt-run').click();
    const pending = page.waitForEvent('download');
    await page.getByTestId('emt-export-json').click();
    const exported = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
    const result = exported.result ?? exported;
    expect(result.config.capacitance_mf).toBe(expected);
    const native = JSON.parse(
      execFileSync(
        process.env.TWIN_PYTHON || 'python',
        [
          '-c',
          'import json,sys;from datacenter_twin.emt import simulate_emt;print(json.dumps(simulate_emt(json.load(sys.stdin))))',
        ],
        {
          cwd: '../..',
          input: JSON.stringify(result.config),
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
        },
      ),
    );
    expect(compareEmt(result, native)).toBeLessThanOrEqual(1e-7);
  }
  await page.getByTestId('emt-refine').click();
  await expect(page.getByText(/20.*10.*µs/).first()).toBeVisible();
  await page.getByLabel('Verify EMT against Python').check();
  await expect(page.getByTestId('emt-python-status')).toContainText(
    'Python agrees across all 2001 samples',
  );
  await page.getByLabel('Verify EMT against Python').uncheck();
  await page.getByTestId('emt-source_v').fill('0');
  await page.getByTestId('emt-run').click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.getByTestId('emt-source_v').fill('800');
  await page.screenshot({ path: info.outputPath('emt-desktop.png'), fullPage: true });
});

test('EMT study is responsive, keyboard accessible and motion controllable', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?mode=emt');
  await expect(page.getByTestId('emt-results')).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const violations = (
      await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations;
    expect(violations).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  await expect(page.getByTestId('emt-play')).toHaveAttribute('aria-label', 'Play replay');
  await page.getByRole('button', { name: /Jump to sag/ }).click();
  await expect(page.locator('#emt-seek')).toHaveAttribute('aria-valuetext', '40 milliseconds');
  await page.getByTestId('emt-play').click();
  await expect.poll(() => page.locator('#emt-seek').inputValue()).not.toBe('400');
  await page.getByTestId('emt-play').click();
  const paused = await page.locator('#emt-seek').inputValue();
  await page.waitForTimeout(100);
  expect(await page.locator('#emt-seek').inputValue()).toBe(paused);
  const component = page.getByRole('button', { name: /capacitor.*Select for details/i });
  await component.focus();
  await page.keyboard.press('Enter');
  await expect(component).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath('emt-components.png'), fullPage: true });
});
