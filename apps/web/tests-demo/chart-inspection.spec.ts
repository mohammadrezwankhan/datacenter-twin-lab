import { expect, test, devices } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const demoBase = `http://127.0.0.1:4174${process.env.TWIN_DEMO_BASE || '/datacenter-twin-lab/'}`;

async function downloadJson(page: import('@playwright/test').Page, label: string) {
  const pending = page.waitForEvent('download');
  if (label === 'export-run') await page.getByRole('button', { name: 'Export run' }).click();
  else await page.getByTestId(label).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function screenPoint(svg: import('@playwright/test').Locator, viewX: number, viewY: number) {
  return svg.evaluate(
    (element, point) => {
      const svg = element as SVGSVGElement;
      const matrix = svg.getScreenCTM();
      if (!matrix) throw new Error('SVG has no screen transform');
      const local = svg.createSVGPoint();
      local.x = point.x;
      local.y = point.y;
      const screen = local.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    },
    { x: viewX, y: viewY },
  );
}

test('research curve drag selects real samples with letterboxing, keyboard seek, and unchanged results', async ({
  page,
}) => {
  await page.goto('./?study=load-step');
  await page.getByTestId('research-run').click();
  const chart = page.locator('.research-chart-card').first();
  const svg = chart.locator('.research-line-chart');
  await svg.evaluate((element) => {
    (element as SVGSVGElement).style.height = '420px';
  });

  const xValues = await chart
    .locator('.research-data-details tbody tr td:first-child')
    .allTextContents();
  const samples = xValues.map((value) => Number(value.replaceAll(',', '')));
  const input = chart.locator('.research-chart-focus-readout input');
  const baseline = await downloadJson(page, 'research-export-json');
  const plotLeft = 75;
  const plotWidth = 760 - 75 - 25;
  const plotTop = 24;
  const plotHeight = 330 - 24 - 56;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const padding = (max - min) * 0.06;
  const domainMin = min - padding;
  const domainMax = max + padding;
  for (const index of [0, Math.floor((samples.length - 1) / 2), samples.length - 1]) {
    const viewX = plotLeft + ((samples[index]! - domainMin) / (domainMax - domainMin)) * plotWidth;
    const point = await screenPoint(svg, viewX, plotTop + plotHeight / 2);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 2 });
    await page.mouse.up();
    await expect(input).toHaveValue(String(index));
    await expect(chart.locator('.research-chart-values')).toContainText(
      `Nearest sampled point · Time (s): ${samples[index]}`,
    );
  }

  const beforeKeyboard = Number(await input.inputValue());
  await input.press('ArrowLeft');
  await expect(input).toHaveValue(String(Math.max(0, beforeKeyboard - 1)));
  const after = await downloadJson(page, 'research-export-json');
  expect(after).toEqual(baseline);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('EMT phone touch drag inspects exact signed rows without changing the applied run', async ({
  browser,
}) => {
  const context = await browser.newContext({ ...devices['iPhone 13'], baseURL: demoBase });
  try {
    const page = await context.newPage();
    await page.goto('./?mode=emt');
    const baseline = await downloadJson(page, 'emt-export-json');
    const chart = page.locator('.emt-chart').first();
    await chart.evaluate((element) => {
      (element as SVGSVGElement).style.height = '250px';
    });
    await chart.scrollIntoViewIfNeeded();
    const slider = page.locator('#emt-seek');
    const touch = await context.newCDPSession(page);
    await touch.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      configuration: 'mobile',
    });
    const from = await screenPoint(chart, 64 + (720 - 64 - 19) * 0.2, 130);
    const to = await screenPoint(chart, 64 + (720 - 64 - 19) * 0.7, 130);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x: from.x, y: from.y }],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: to.x, y: to.y }],
    });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(slider).toHaveValue('1400');
    await expect(chart.locator('..').getByTestId('emt-chart-inspection')).toContainText(
      'Time: 140.0000 ms',
    );

    const currentChart = page.locator('.emt-chart').nth(1);
    const rows = baseline.rows as { time_ms: number; source_a: number }[];
    const negativeIndex = rows.findIndex((row) => row.source_a < 0);
    expect(negativeIndex).toBeGreaterThanOrEqual(0);
    const negativeTime = rows[negativeIndex]!.time_ms;
    const viewX = 64 + ((720 - 64 - 19) * negativeTime) / 200;
    const currentPoint = await screenPoint(currentChart, viewX, 130);
    await page.mouse.move(currentPoint.x, currentPoint.y);
    await expect(page.locator('.emt-chart-inspection').nth(1)).toContainText(
      `Source current: ${new Intl.NumberFormat('en', { maximumFractionDigits: 3, minimumFractionDigits: 3 }).format(rows[negativeIndex]!.source_a)} A`,
    );

    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue(String(negativeIndex + 1));
    const after = await downloadJson(page, 'emt-export-json');
    expect(after).toEqual(baseline);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await touch.detach();
  } finally {
    await context.close();
  }
});

test('power timeline pointer selects the containing interval and keyboard seek stays available', async ({
  page,
}) => {
  await page.goto('./?preset=generator_failure');
  await page.getByRole('button', { name: 'Run scenario' }).click();
  const baseline = await downloadJson(page, 'export-run');
  const rows = baseline.intervals as { start_s: string; end_s: string }[];
  expect(rows.length).toBeGreaterThan(2);
  const svg = page.locator('.power-chart');
  await svg.scrollIntoViewIfNeeded();
  const slider = page.getByLabel('Replay interval');
  for (const index of [0, Math.floor((rows.length - 1) / 2), rows.length - 1]) {
    const start = Number(rows[index]!.start_s);
    const viewX = 46 + ((940 - 46 - 16) * start) / Number(baseline.scenario.duration_s);
    const point = await screenPoint(svg, viewX, 90);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 2 });
    await page.mouse.up();
    await expect(slider).toHaveValue(String(index));
    await expect(page.getByTestId('power-chart-inspection')).toContainText(
      `${Number(rows[index]!.start_s).toLocaleString('en-US')}–${Number(rows[index]!.end_s).toLocaleString('en-US')} s`,
    );
  }
  const selected = Number(await slider.inputValue());
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveValue(String(selected - 1));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
