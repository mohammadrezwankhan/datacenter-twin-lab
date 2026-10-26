import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { EmtResult } from '../src/emt/engine';
import type { ResearchResult } from '../src/research/types';

async function downloaded(page: Page, button: Locator): Promise<string> {
  const pending = page.waitForEvent('download');
  await button.click();
  const path = await (await pending).path();
  assert.ok(path, 'the browser must produce a real download');
  return readFile(path, 'utf8');
}

function csvRows(text: string): string[][] {
  return JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      [
        '-c',
        'import csv,io,json,sys;print(json.dumps(list(csv.reader(io.StringIO(sys.stdin.read())))))',
      ],
      { input: text, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    ),
  );
}

test('prediction shortcut is visible and focuses the input at desktop and phone widths', async ({
  page,
}, info) => {
  for (const [width, height] of [
    [1905, 889],
    [375, 844],
    [320, 780],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('./');
    const link = page.getByRole('link', { name: /Make a prediction/ });
    const input = page.getByTestId('guide-prediction');
    await expect(input).toBeAttached();
    await expect(link).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth), {
        timeout: 5000,
      })
      .toBeLessThanOrEqual(0);
    await page.screenshot({ path: info.outputPath('prediction-' + width + '.png') });
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(input).toBeFocused();
    await expect(input).toBeInViewport();
    await expect(page.getByTestId('guide-result')).toHaveCount(0);
  }
});

test('visible reset label and commissioning PUE constraint are exposed to the browser', async ({
  page,
}) => {
  await page.goto('./?lesson=power-energy');
  const reset = page.getByRole('button', { name: /^Starting input\b/ });
  await expect(reset).toContainText('Starting input');
  await reset.focus();
  await page.keyboard.press('Enter');
  await page.goto('./?lesson=commissioning-evidence-loop');
  const pue = page.getByRole('spinbutton', { name: /^Pue/ });
  await expect(pue).toHaveAttribute('min', '1');
  await pue.fill('0.5');
  await page.getByRole('button', { name: 'Run screen', exact: true }).click();
  expect(await pue.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);
  await expect(page.getByTestId('infrastructure-run-state')).toContainText('No completed result');
  await pue.fill('1');
  await page.getByRole('button', { name: 'Run screen', exact: true }).click();
  await expect(page.getByTestId('infrastructure-run-state')).toContainText('Completed case');
  const payload = JSON.parse(
    await downloaded(page, page.getByRole('button', { name: 'Export completed screen' })),
  );
  expect(payload.result.outputs.annualFacilityMWh).toBe(payload.result.outputs.annualItMWh);
});

test('capacity equality and a genuine shortfall remain distinct through the rendered form', async ({
  page,
}) => {
  await page.goto('./?lesson=resilience-state-matrix');
  for (const [label, value] of [
    ['Required MW', '2.1'],
    ['Unit MW', '0.7'],
    ['Derating', '1'],
    ['Loading', '1'],
    ['Installed', '4'],
    ['Unavailable', '1'],
  ]) {
    await page.getByRole('spinbutton', { name: new RegExp('^' + label + '( |$)') }).fill(value);
  }
  for (const [demand, status, count] of [
    ['2.1', 'screen-satisfied', 4],
    ['2.1000000001', 'screen-failed', 5],
  ] as const) {
    await page.getByRole('spinbutton', { name: /^Required MW/ }).fill(demand);
    await page.getByRole('button', { name: 'Run screen', exact: true }).click();
    await expect(page.getByTestId('infrastructure-run-state')).toContainText('Completed case');
    const payload = JSON.parse(
      await downloaded(page, page.getByRole('button', { name: 'Export completed screen' })),
    );
    expect(payload.result.outputs.status).toBe(status);
    expect(payload.result.outputs.minimumNPlusOne).toBe(count);
  }
});

test('actual EMT CSV downloads preserve every sample and applied inputs after draft edits', async ({
  page,
}) => {
  await page.goto('./?mode=emt');
  await expect(page.getByTestId('emt-export-csv')).toBeVisible();
  await page.getByTestId('emt-capacitance_mf').fill('24');
  for (const expected of [12, 24]) {
    if (expected === 24) await page.getByTestId('emt-run').click();
    const json = JSON.parse(await downloaded(page, page.getByTestId('emt-export-json')));
    const result: EmtResult = json.result ?? json;
    const rows = csvRows(await downloaded(page, page.getByTestId('emt-export-csv')));
    assert.equal(result.config.capacitance_mf, expected);
    assert.equal(rows.length, result.rows.length + 1);
    assert.equal(rows[0][8], 'applied_config_json');
    for (const [index, sample] of result.rows.entries()) {
      const row = rows[index + 1];
      assert.deepEqual(row.slice(0, 7).map(Number), [
        sample.time_ms,
        sample.source_v,
        sample.bus_v,
        sample.source_a,
        sample.load_a,
        sample.stored_j,
        sample.balance_error_j,
      ]);
      assert.equal(row[7], result.model);
      assert.deepEqual(JSON.parse(row[8]), result.config);
      assert.deepEqual(JSON.parse(row[9]), result.assumptions);
      assert.match(row[10], /Educational/);
    }
  }
});

test('actual dynamics CSV, completion status and chart labels describe the completed run', async ({
  page,
}, info) => {
  await page.goto('./?study=forced-response');
  const status = page.getByTestId('research-completion-status');
  const mountedStatus = await status.elementHandle();
  assert.ok(mountedStatus);
  await expect(status).toBeEmpty();
  await page.getByTestId('research-run').click();
  await expect(status).toHaveText('Forced response complete. Results are ready.');
  expect(
    await mountedStatus.evaluate(
      (element) => element === document.querySelector('[data-testid="research-completion-status"]'),
    ),
  ).toBe(true);
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveAttribute('aria-atomic', 'true');
  const sliders = page.getByRole('slider', { name: /^Focus a data point on / });
  expect(await sliders.count()).toBeGreaterThan(0);
  await sliders.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(sliders.first()).toBeFocused();
  const result = JSON.parse(
    await downloaded(page, page.getByTestId('research-export-json')),
  ) as ResearchResult;
  await page.getByTestId('research-input-forcing_amplitude_pu').fill('0.07');
  const rows = csvRows(await downloaded(page, page.getByTestId('research-export-csv')));
  assert.equal(rows[0][9], 'applied_config_json');
  let index = 1;
  for (const chart of result.charts) {
    for (let sample = 0; sample < chart.x.length; sample++) {
      for (const line of chart.lines) {
        const row = rows[index++];
        assert.deepEqual(row.slice(0, 7), [
          chart.id,
          chart.title,
          chart.x_label,
          String(chart.x[sample]),
          line.label,
          chart.y_label,
          String(line.values[sample]),
        ]);
        assert.equal(row[7], result.study_id);
        assert.equal(row[8], result.model);
        assert.deepEqual(JSON.parse(row[9]), result.config);
        assert.deepEqual(JSON.parse(row[10]), result.solver);
        assert.deepEqual(JSON.parse(row[11]), result.assumptions);
        assert.match(row[12], /Educational/);
      }
    }
  }
  assert.equal(rows.length, index);
  await info.attach('download-verification', {
    body: JSON.stringify({ samples: rows.length - 1, appliedConfig: result.config }),
    contentType: 'application/json',
  });
  await page.screenshot({ path: info.outputPath('forced-response-applied.png'), fullPage: true });
});

test('the engineering poster stays contained while its shadow stylesheet is loading', async ({
  page,
}) => {
  let releaseStylesheet!: () => void;
  const stylesheetGate = new Promise<void>((resolve) => {
    releaseStylesheet = resolve;
  });
  await page.route('**/engineering-hero/v1/integration/vanilla/embed.css', async (route) => {
    await stylesheetGate;
    await route.continue();
  });
  try {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const poster = document
        .querySelector('khan-grid-hero')
        ?.shadowRoot?.querySelector<HTMLImageElement>('.poster');
      return poster?.complete && poster.naturalWidth === 1920;
    });
    for (const width of [1440, 820, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
    }
  } finally {
    releaseStylesheet();
  }
  await expect(page.getByRole('button', { name: 'Play animation' })).toBeVisible();
});

test('Back during initial workspace loading restores the URL preset', async ({ page }) => {
  await page.addInitScript(() => {
    const original = location.href;
    const previous = new URL(original);
    previous.searchParams.set('preset', 'normal');
    history.replaceState(null, '', previous);
    history.pushState(null, '', original);
  });
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    reached = resolve;
  });
  await page.route('**/demo-data.json', async (route) => {
    reached();
    await gate;
    await route.continue();
  });
  await page.goto('./?mode=advanced&preset=ai_cluster_generator_failure');
  await requestStarted;
  await page.goBack();
  release();
  await expect(page).toHaveURL(/preset=normal/);
  const scenario = page.getByRole('combobox', { name: 'Scenario', exact: true });
  await expect(scenario).toBeEnabled();
  await expect(scenario).toHaveValue('normal', { timeout: 10000 });
});

test('changing workspace subview preserves an in-progress preset restoration', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & {
      holdSimulation?: boolean;
      releaseSimulation?: () => void;
    };
    const postMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (...args: Parameters<Worker['postMessage']>) {
      const deliver = () => postMessage.apply(this, args);
      if (state.holdSimulation && args[0]?.path === 'simulations') {
        state.holdSimulation = false;
        state.releaseSimulation = deliver;
      } else deliver();
    };
  });
  await page.goto('./?mode=advanced&preset=normal');
  const scenario = page.getByRole('combobox', { name: 'Scenario', exact: true });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(scenario).toBeEnabled();
  await nav.getByRole('button', { name: 'Power topology', exact: true }).click();
  await scenario.selectOption('ai_cluster_generator_failure');
  await expect(scenario).toBeEnabled();
  await page.evaluate(() => {
    (window as typeof window & { holdSimulation: boolean }).holdSimulation = true;
  });
  await page.goBack();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as typeof window & { releaseSimulation?: () => void }).releaseSimulation),
      ),
    )
    .toBe(true);
  await nav.getByRole('button', { name: 'Power topology', exact: true }).click();
  await page.evaluate(() => {
    (window as typeof window & { releaseSimulation: () => void }).releaseSimulation();
  });
  await expect(scenario).toBeEnabled();
  await expect(page).toHaveURL(/preset=normal/);
  await expect(scenario).toHaveValue('normal', { timeout: 10000 });
});
