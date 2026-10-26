import { expect, test, type Locator } from '@playwright/test';
import { lessons } from '../src/course-lessons';

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const literal = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function visibleNameIsAvailable(control: Locator) {
  const text = normalize((await control.locator('text:visible').allTextContents()).join(' '));
  expect(text, 'The scene control has a visible text label').not.toBe('');
  await expect
    .soft(control, `The accessible name contains the complete visible label: ${text}`)
    .toHaveAccessibleName(new RegExp(literal(text), 'i'), { timeout: 1000 });
}

for (const width of [1440, 390]) {
  test(`power scene names and interval details remain available at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('./?mode=advanced');
    const scene = page.locator('.power-scene');
    await expect(scene).toBeVisible();
    await scene.getByRole('button', { name: 'Pause animation', exact: true }).click();

    for (const source of ['grid', 'site', 'battery', 'generator']) {
      const control = scene.locator(`.power-scene-object.source-${source}`);
      await expect(control).toBeVisible();
      await visibleNameIsAvailable(control);
      await expect.soft(control).toHaveAccessibleDescription(/kW/i, { timeout: 1000 });
      if (source === 'battery') {
        await expect.soft(control).toHaveAccessibleDescription(/kWh/i, { timeout: 1000 });
      }
      if (source === 'site') {
        await expect.soft(control).toHaveAccessibleDescription(/requested.*unserved/i, {
          timeout: 1000,
        });
      }
      await control.focus();
      await control.press(source === 'battery' ? 'Space' : 'Enter');
      await expect(control).toHaveAttribute('aria-pressed', 'true');
    }
  });
}

test('continuity lesson scene names include their visible labels and keep inspection details', async ({
  page,
}) => {
  await page.goto('./?lesson=power-energy');
  for (const lesson of lessons) {
    await test.step(lesson.id, async () => {
      await page.getByLabel('Choose a lesson').selectOption(lesson.id);
      await expect(page.getByTestId('course')).toHaveAttribute('data-lesson', lesson.id);
      await expect(page.getByTestId('lesson-result')).toBeVisible();
      const controls = page.locator('.lesson-scene-object');
      await expect(controls.first()).toBeVisible();
      for (const control of await controls.all()) {
        await visibleNameIsAvailable(control);
        await expect.soft(control).toHaveAccessibleDescription(/\S/, { timeout: 1000 });
        await control.focus();
        await control.press('Enter');
        await expect(control).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });
      }
    });
  }
});
