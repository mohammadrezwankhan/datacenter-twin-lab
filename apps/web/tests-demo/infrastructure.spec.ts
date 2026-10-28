import { expect, test, type Download, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { infrastructureLessons } from '../seo-infrastructure';
import {
  buildScreenResult,
  calculateScreen,
  canonicalJson,
  screenUnits,
  type ModelName,
  type ScreenInputs,
  type ScreenOutputs,
} from '../src/infrastructure/screens';
import { fuelEvidence, fuelInputs } from '../src/infrastructure/fuel';

const sha256 = (value: unknown) =>
  createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
const SCREEN_REL_TOL = 1e-11;
const SCREEN_ABS_TOL = 1e-10;
const titleFor = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase());
const equationCheck: Record<string, string> = {
  loadLedger: 'IT kW = racks × rack kW',
  capacityBank: 'Usable unit MW = unit MW × derating × loading',
  transformerScreen: 'Zbase = V²/(S × 10⁶)',
  storageScreen: 'AC kWh = AC kW × minutes/60',
  inverseTime: 'For M > 1: t(s)',
  auxiliaryScreen: 'THD(%) = 100 × harmonic A/fundamental A',
  thermalScreen: 'Liquid kW = rack kW × capture fraction',
  networkScreen: 'Physical dB = length m/1,000',
  facilityScreen: 'Average kPa = mass kg × gravity m/s²',
  commissioningScreen: 'Restoration s = sum of declared stage s',
  designReview: 'Available MVA per side = (units per side − unavailable)',
};
const lessonById = (id: string) => {
  const lesson = infrastructureLessons.find((item) => item.id === id);
  if (!lesson) throw new Error(`Missing infrastructure lesson ${id}`);
  return lesson;
};
const appliedInputs = (id: string, challenge: boolean): ScreenInputs => {
  const lesson = lessonById(id);
  return challenge
    ? { ...lesson.experiment.defaultInputs, ...lesson.experiment.challenge.changes }
    : lesson.experiment.defaultInputs;
};
const inputLabel = (model: ModelName, key: string) => {
  const unit = screenUnits(model).inputs[key];
  return `${titleFor(key)}${unit ? ` (${unit})` : ''}`;
};

// Match verify_infrastructure.py's numeric tolerances; keep discrete outputs exact.
function assertScreenOutputsMatchAcrossRuntimes(actual: ScreenOutputs, expected: ScreenOutputs) {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  for (const key of Object.keys(expected)) {
    const actualValue = actual[key];
    const expectedValue = expected[key];
    if (typeof expectedValue === 'number') {
      expect(typeof actualValue).toBe('number');
      const actualNumber = actualValue as number;
      expect(Number.isFinite(actualNumber)).toBe(true);
      if (Number.isInteger(expectedValue)) {
        expect(actualNumber).toBe(expectedValue);
        continue;
      }
      const tolerance = Math.max(
        SCREEN_ABS_TOL,
        SCREEN_REL_TOL * Math.max(Math.abs(actualNumber), Math.abs(expectedValue)),
      );
      expect(
        Math.abs(actualNumber - expectedValue),
        `${key} should match across runtimes within rel=${SCREEN_REL_TOL} / abs=${SCREEN_ABS_TOL}`,
      ).toBeLessThanOrEqual(tolerance);
      continue;
    }
    expect(actualValue).toEqual(expectedValue);
  }
}

async function exportCompleted(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export completed screen' }).click();
  const download: Download = await pending;
  const path = await download.path();
  if (!path) throw new Error('Completed screen export did not create a downloadable file');
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, any>;
}

function assertResult(
  payload: Record<string, any>,
  id: string,
  inputs: ScreenInputs,
  prediction: string,
) {
  const lesson = lessonById(id);
  const result = payload.result as Record<string, any>;
  const outputs = calculateScreen(lesson.experiment.model, inputs);
  expect(payload).toMatchObject({
    exportSchema: 'infrastructure-lesson-export-1',
    engineeringDecision: 'HOLD',
    independentEngineeringVerification: false,
    prediction,
  });
  assertRawResult(result, lesson, inputs, lesson.experiment.model, outputs);
  const exportMaterial: Record<string, unknown> = {
    result,
    prediction,
    review: payload.review ?? null,
  };
  if (Object.hasOwn(payload, 'fuel')) exportMaterial.fuel = payload.fuel;
  expect(payload.exportHash).toBe(sha256(exportMaterial));
}

function assertRawResult(
  result: Record<string, any>,
  lesson: (typeof infrastructureLessons)[number],
  inputs: ScreenInputs,
  model: ModelName,
  outputs: ScreenOutputs,
) {
  expect(result.resultSchema).toBe('infrastructure-screen-1');
  expect(result.lessonId).toBe(lesson.id);
  expect(result.model).toBe(model);
  expect(result.contentVersion).toBe(lesson.contentVersion);
  expect(result.modelVersion).toBe('1.0.0');
  expect(result.inputs).toEqual(inputs);
  assertScreenOutputsMatchAcrossRuntimes(result.outputs, outputs);
  expect(result.inputUnits).toEqual(
    Object.fromEntries(Object.keys(inputs).map((key) => [key, screenUnits(model).inputs[key]])),
  );
  expect(Object.keys(result.outputUnits).sort()).toEqual(Object.keys(outputs).sort());
  for (const [key, unit] of Object.entries(result.outputUnits))
    expect(unit).toBe(screenUnits(model).outputs[key]);
  expect(result.assumptions.length).toBeGreaterThan(0);
  expect(result.limitations.length).toBeGreaterThan(0);
  expect(result.sourceLocators).toEqual([
    {
      id: lesson.source.id,
      chapter: lesson.source.chapter,
      pdfPages: [lesson.source.pdfPages[0], lesson.source.pdfPages.at(-1)],
      evidenceStatus: lesson.source.evidenceStatus,
    },
  ]);
  expect(result.independentEngineeringVerification).toBe(false);
  expect(Object.keys(result)).not.toContain('legacyVerification');
  expect(Object.keys(result)).not.toContain('pythonVerification');

  const inputMaterial = {
    resultSchema: 'infrastructure-screen-1',
    contentVersion: lesson.contentVersion,
    modelVersion: '1.0.0',
    lessonId: lesson.id,
    model,
    inputs,
  };
  expect(result.inputHash).toBe(sha256(inputMaterial));
  const { resultHash, ...withoutResultHash } = result;
  expect(resultHash).toBe(sha256(withoutResultHash));
}

async function runAndCheck(page: Page, id: string, inputs: ScreenInputs, prediction: string) {
  const lesson = lessonById(id);
  await page.getByLabel('Your prediction (optional)').fill(prediction);
  await page.getByRole('button', { name: 'Run screen' }).click();
  await expect(page.getByTestId('infrastructure-run-state')).toContainText('Completed case');
  const result = calculateScreen(lesson.experiment.model, inputs);
  for (const [key, value] of Object.entries(result))
    await expect(
      page.locator('[aria-label="Infrastructure experiment"]').locator(`[data-output="${key}"]`),
    ).toBeVisible();
  const payload = await exportCompleted(page);
  assertResult(payload, id, inputs, prediction);
  if (id === 'generator-bank-fuel') {
    const expectedFuel = await buildScreenResult(
      fuelEvidence(lesson),
      fuelInputs,
      payload.result.sourceRevision,
    );
    expect(payload.fuel).toEqual(expectedFuel);
    assertRawResult(
      payload.fuel,
      lesson,
      fuelInputs,
      'fuelScreen',
      calculateScreen('fuelScreen', fuelInputs),
    );
    expect(payload.fuel.outputs.usableLitres).toBe(324000);
  } else {
    expect(payload.fuel).toBeNull();
  }
  return payload;
}

test('all twelve lessons run exact defaults and challenges, export canonical raw results, and expose assessments', async ({
  page,
}) => {
  test.setTimeout(300000);
  for (const lesson of infrastructureLessons) {
    await page.goto(`./?lesson=${lesson.id}`);
    const app = page.locator(`.infrastructure-course[data-lesson="${lesson.id}"]`);
    await expect(app).toBeVisible();
    await expect(app.locator('.infra-hold')).toContainText('Engineering HOLD');
    await expect(app.locator('section[aria-label="Teaching prose"] article')).toHaveCount(
      lesson.sections.length,
    );
    for (const section of lesson.sections) {
      const block = app.locator(`article[data-evidence-label="${section.evidenceLabel}"]`).filter({
        has: page.getByRole('heading', { name: section.title, exact: true }),
      });
      await expect(block.locator('h3')).toHaveText(section.title);
      await expect(block).toContainText(section.body);
    }
    await expect(
      app.locator('section[aria-label="Three lesson assessments"] .infra-assessment'),
    ).toHaveCount(3);
    for (const assessment of lesson.assessments) {
      const card = app.locator('.infra-assessment').filter({
        has: page.getByRole('heading', {
          name: `${assessment.id} · ${assessment.question}`,
          exact: true,
        }),
      });
      await expect(card.locator('h4')).toContainText(assessment.question);
      await expect(card.locator('details')).not.toHaveAttribute('open', '');
      await card.getByText('Show answer and marking criterion').click();
      await expect(card.locator('details')).toHaveAttribute('open', '');
      await expect(card.locator('details')).toContainText(assessment.answer);
      await expect(card.locator('details')).toContainText(assessment.rubric);
      await expect(card.locator('details')).toContainText(assessment.source);
      await card.getByText('Show answer and marking criterion').click();
      await expect(card.locator('details')).not.toHaveAttribute('open', '');
    }

    const noResult = app.getByTestId('infrastructure-run-state');
    await expect(noResult).toContainText('No completed result');
    await expect(app.getByRole('button', { name: 'Export completed screen' })).toHaveCount(0);
    const defaultPrediction = `default prediction ${lesson.id}`;
    const defaultPayload = await runAndCheck(
      page,
      lesson.id,
      appliedInputs(lesson.id, false),
      defaultPrediction,
    );
    if (lesson.id === 'generator-bank-fuel') {
      expect(defaultPayload.result.outputs.availableMW).toBeCloseTo(21.6, 10);
      expect(defaultPayload.result.outputs.marginMW).toBeCloseTo(-5.4, 10);
      expect(defaultPayload.result.outputs.availableMW).toBeLessThan(
        defaultPayload.result.inputs.requiredMW,
      );
    }
    if (lesson.id === 'ups-battery-station-dc') {
      expect(defaultPayload.result.outputs.acKWh).toBe(375);
      expect(defaultPayload.result.outputs.nominalKWh).toBeCloseTo(616.78, 2);
    }
    if (lesson.id === 'thermal-liquid-continuity')
      expect(defaultPayload.result.outputs.thermalLimitS).toBe(37.5);
    if (lesson.id === 'commissioning-evidence-loop') {
      expect(defaultPayload.result.outputs.restoreSeconds).toBe(25);
      expect(defaultPayload.result.outputs.thermalMarginSeconds).toBe(12.5);
      await expect(app.locator('.infra-scene')).toContainText('25 s');
    }

    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations, `WCAG 2.2 AA for ${lesson.id}`).toEqual([]);
    await expect(app.locator('.legacy-verification, .verification-badge')).toHaveCount(0);
    await expect(app.getByText('Exact match with Python')).toHaveCount(0);

    await app.getByRole('button', { name: 'Apply challenge' }).click();
    const challengePrediction = `challenge prediction ${lesson.id}`;
    const challengePayload = await runAndCheck(
      page,
      lesson.id,
      appliedInputs(lesson.id, true),
      challengePrediction,
    );
    expect(challengePayload.result.inputs).toEqual(appliedInputs(lesson.id, true));
    if (lesson.id === 'generator-bank-fuel') {
      expect(challengePayload.result.outputs.availableMW).toBeCloseTo(28.8, 10);
      expect(challengePayload.result.outputs.marginMW).toBeCloseTo(1.8, 10);
    }
    if (lesson.id === 'ups-battery-station-dc') {
      expect(challengePayload.result.outputs.acKWh).toBe(562.5);
      expect(challengePayload.result.outputs.nominalKWh).toBeCloseTo(925.16, 2);
    }
    if (lesson.id === 'commissioning-evidence-loop') {
      expect(challengePayload.result.outputs.restoreSeconds).toBe(40);
      expect(challengePayload.result.outputs.thermalMarginSeconds).toBe(-2.5);
    }
  }
});

test('twelve static notes work without JavaScript and preserve source, worked cases, equations, and mount-relative links', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300000);
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  const requestContext = await page.context().request;
  try {
    for (const lesson of infrastructureLessons) {
      const response = await page.goto(`./${lesson.readingRoute}`);
      expect(response?.status(), `${lesson.id} static page`).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(lesson.title);
      await expect(page.getByText('Engineering HOLD', { exact: false }).first()).toBeVisible();
      await expect(
        page.getByText(new RegExp(`chapter ${lesson.source.chapter}`, 'i')).first(),
      ).toBeVisible();
      await expect(page.getByText('Worked default — unrounded educational outputs')).toBeVisible();
      await expect(page.getByText('Worked challenge')).toBeVisible();
      if (lesson.experiment.model === 'fuelScreen') {
        await expect(
          page.getByText('Usable L = load kW × hours × L/kWh', { exact: false }),
        ).toBeVisible();
      } else {
        const equation = await page.locator('.equation').textContent();
        expect(equation).toContain(equationCheck[lesson.experiment.model]);
      }
      await expect(page.locator('details')).toHaveCount(3);
      // Local browser security software can inject its own scripts into the DOM.
      const staticHtml = await readFile(
        new URL(
          `../../../.local/browser-demo-site/${lesson.readingRoute}index.html`,
          import.meta.url,
        ),
        'utf8',
      );
      expect(staticHtml).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
      for (const section of lesson.sections) {
        await expect(page.getByRole('heading', { name: section.title, exact: true })).toBeVisible();
      }
      for (const assessment of lesson.assessments)
        await expect(
          page.getByRole('heading', {
            name: `${assessment.id} · ${assessment.question}`,
            exact: true,
          }),
        ).toBeVisible();

      const resultsResponse = await requestContext.get(
        new URL('results.json', page.url()).toString(),
      );
      expect(resultsResponse.status()).toBe(200);
      const results = await resultsResponse.json();
      expect(results.engineeringDecision).toBe('HOLD');
      assertRawResult(
        results.starting,
        lesson,
        lesson.experiment.defaultInputs,
        lesson.experiment.model,
        calculateScreen(lesson.experiment.model, lesson.experiment.defaultInputs),
      );
      assertRawResult(
        results.challenge,
        lesson,
        appliedInputs(lesson.id, true),
        lesson.experiment.model,
        calculateScreen(lesson.experiment.model, appliedInputs(lesson.id, true)),
      );
      expect(results.fuel).toEqual(lesson.id === 'generator-bank-fuel' ? expect.any(Object) : null);
      if (lesson.id === 'generator-bank-fuel') {
        assertRawResult(
          results.fuel,
          lesson,
          fuelInputs,
          'fuelScreen',
          calculateScreen('fuelScreen', fuelInputs),
        );
        expect(results.fuel.outputs.usableLitres).toBe(324000);
      }

      const linkTargets = await page
        .locator('a[href]')
        .evaluateAll((links) =>
          links
            .map((link) => (link as HTMLAnchorElement).href)
            .filter((href) => new URL(href).origin === location.origin),
        );
      expect(linkTargets.length).toBeGreaterThanOrEqual(3);
      const mountPath = new URL(baseURL!).pathname;
      for (const href of linkTargets) {
        const target = new URL(href);
        expect(target.pathname.startsWith(mountPath), `${lesson.id} relative link ${href}`).toBe(
          true,
        );
        const linkResponse = await requestContext.get(href);
        expect(linkResponse.status(), `${lesson.id} linked static destination ${href}`).toBe(200);
      }
    }
  } finally {
    await context.close();
  }
});

test('invalid domains, no-trip, disconnected network, and no-rise thermal states remain explicit', async ({
  page,
}) => {
  await page.goto('./?lesson=protection-trip-chain');
  await page.getByLabel(inputLabel('inverseTime', 'multiple')).fill('1');
  await page.getByRole('button', { name: 'Run screen' }).click();
  await expect(page.getByTestId('infrastructure-run-state')).toContainText('Completed case');
  const noTrip = await exportCompleted(page);
  expect(noTrip.result.outputs.tripS).toBeNull();
  expect(noTrip.result.outputs.status).toBe('outside-trip-domain');

  await page.goto('./?lesson=network-optical-budget');
  await page.getByLabel(inputLabel('networkScreen', 'lostUplinks')).fill('6');
  await page.getByRole('button', { name: 'Run screen' }).click();
  await expect(page.getByTestId('infrastructure-run-state')).toContainText('Completed case');
  const disconnected = await exportCompleted(page);
  expect(disconnected.result.outputs.connectivity).toBe('disconnected');
  expect(disconnected.result.outputs.activeUplinkGbps).toBe(0);
  expect(disconnected.result.outputs.oversubscription).toBeNull();
  expect(disconnected.result.outputs.status).toBe('screen-satisfied');

  await page.goto('./?lesson=thermal-liquid-continuity');
  await page.getByLabel(inputLabel('thermalScreen', 'removedMW')).fill('20');
  await page.getByRole('button', { name: 'Run screen' }).click();
  await expect(page.getByTestId('infrastructure-run-state')).toContainText('Completed case');
  const noRise = await exportCompleted(page);
  expect(noRise.result.outputs.temperatureRiseKS).toBe(0);
  expect(noRise.result.outputs.thermalLimitS).toBeNull();
  expect(noRise.result.outputs.status).toBe('no-rise-in-lumped-model');

  await page.goto('./?lesson=resilience-state-matrix');
  await page.getByLabel(inputLabel('capacityBank', 'derating')).fill('1.01');
  await page.getByRole('button', { name: 'Run screen' }).click();
  await expect(page.getByRole('alert')).toContainText(/derating.*\[0, 1\]/i);
  await expect(page.getByRole('button', { name: 'Export completed screen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset inputs' }).click();
  await page.getByLabel(inputLabel('capacityBank', 'installed')).fill('6.5');
  await page.getByRole('button', { name: 'Run screen' }).click();
  await expect(page.getByRole('alert')).toContainText(/integer/i);
  await page.goto('./?lesson=commissioning-evidence-loop');
  await page.getByLabel(inputLabel('commissioningScreen', 'stageSeconds')).fill('2, 12, 3, 1e309');
  await page.getByRole('button', { name: 'Run screen' }).click();
  await expect(page.getByRole('alert')).toContainText(/finite/i);
  await expect(page.getByRole('button', { name: 'Export completed screen' })).toHaveCount(0);

  await page.goto('./?lesson=evidence-load-ledger');
  await page.getByLabel(inputLabel('loadLedger', 'rackKW')).fill('1e308');
  await page.getByRole('button', { name: 'Run screen' }).click();
  await expect(page.getByRole('alert')).toContainText(/overflow/i);
  await expect(page.getByRole('button', { name: 'Export completed screen' })).toHaveCount(0);
});

test('exports stay on the last completed input, prediction, result, and six-row capstone review', async ({
  page,
}) => {
  await page.goto('./?lesson=commissioning-evidence-loop');
  const stage = page.getByLabel(inputLabel('commissioningScreen', 'stageSeconds'));
  await stage.fill('2, 12, 3, 8');
  const first = await runAndCheck(
    page,
    'commissioning-evidence-loop',
    { ...appliedInputs('commissioning-evidence-loop', false), stageSeconds: [2, 12, 3, 8] },
    'thermal recovery before arithmetic',
  );
  await stage.fill('2, 12, 3, 23');
  await page.getByLabel('Your prediction (optional)').fill('edited after completed screen');
  await expect(page.getByTestId('infrastructure-run-state')).toContainText('Inputs changed');
  const stale = await exportCompleted(page);
  expect(stale).toEqual(first);

  await page.goto('./?lesson=integrated-design-release');
  const criteria = ['capacity', 'connectivity', 'protection', 'thermal', 'controls', 'evidence'];
  for (const key of criteria) {
    await page.getByLabel(`${titleFor(key)} state`).selectOption('pass');
    await page.getByLabel(`${titleFor(key)} reason`).fill(`${key} claimed reason`);
    await page.getByLabel(`${titleFor(key)} source locator`).fill(`DCIE-R1 chapter 12, ${key}`);
  }
  const capstone = await runAndCheck(
    page,
    'integrated-design-release',
    appliedInputs('integrated-design-release', false),
    'six claimed passes do not establish release',
  );
  expect(capstone.engineeringDecision).toBe('HOLD');
  expect(capstone.review).toMatchObject(
    Object.fromEntries(
      criteria.map((key) => [
        key,
        { state: 'pass', reason: `${key} claimed reason`, source: `DCIE-R1 chapter 12, ${key}` },
      ]),
    ),
  );
  await page.getByLabel('Capacity state').selectOption('fail');
  await page.getByLabel(inputLabel('designReview', 'unitsPerSide')).fill('4');
  await page.getByLabel('Your prediction (optional)').fill('new unsaved claim');
  const capstoneStale = await exportCompleted(page);
  expect(capstoneStale).toEqual(capstone);
  await expect(page.locator('.infra-hold')).toContainText('Engineering HOLD');
});

test('scene keyboard controls, reduced-motion and visibility pauses, route history and conflicts behave predictably', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./?lesson=evidence-load-ledger');
  const scene = page.locator('.infra-scene');
  const nextStep = scene.getByRole('button', { name: 'Next step' });
  await nextStep.focus();
  await page.keyboard.press('Enter');
  await expect(scene.locator('.infra-step-copy')).toContainText('Step 2 of');
  await scene.getByRole('button', { name: 'Play' }).click();
  await expect(scene.getByRole('button', { name: 'Pause' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const play = scene.getByRole('button', { name: 'Play' });
  await expect(play).toBeDisabled();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await scene.getByRole('button', { name: 'Play' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(scene.getByRole('button', { name: 'Pause' })).toHaveCount(0);
  await expect(scene.getByRole('button', { name: 'Play' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.goto('./?lesson=evidence-load-ledger');
  const offscreenScene = page.locator('.infra-scene');
  await offscreenScene.getByRole('button', { name: 'Play' }).click();
  await expect(offscreenScene.getByRole('button', { name: 'Pause' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(offscreenScene.getByRole('button', { name: 'Play' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  const nextLesson = page.getByRole('button', { name: /Next lesson/ });
  await nextLesson.click();
  await expect(page.locator('.infrastructure-course')).toHaveAttribute(
    'data-lesson',
    'resilience-state-matrix',
  );
  await page.getByRole('button', { name: /Previous lesson/ }).click();
  await expect(page.locator('.infrastructure-course')).toHaveAttribute(
    'data-lesson',
    'evidence-load-ledger',
  );
  await page.getByRole('button', { name: /Next lesson/ }).click();
  await expect(page.locator('.infrastructure-course')).toHaveAttribute(
    'data-lesson',
    'resilience-state-matrix',
  );
  await page.goBack();
  await expect(page.locator('.infrastructure-course')).toHaveAttribute(
    'data-lesson',
    'evidence-load-ledger',
  );
  await page.goForward();
  await expect(page.locator('.infrastructure-course')).toHaveAttribute(
    'data-lesson',
    'resilience-state-matrix',
  );

  await page.goto('./?lesson=unknown-infrastructure-lesson');
  await expect(page.locator('.infrastructure-course')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
  await page.goto('./?lesson=evidence-load-ledger&mode=emt');
  await expect(page.locator('.infrastructure-course')).toHaveCount(0);
  await expect(page.getByText(/electromagnetic transient/i).first()).toBeVisible();
});

test('responsive capstone keeps page bounds and provides screenshots at target widths and 200% CSS zoom equivalent', async ({
  page,
}, testInfo) => {
  await page.goto('./?lesson=integrated-design-release');
  await page.getByRole('button', { name: 'Run screen' }).click();
  await expect(page.getByTestId('infrastructure-run-state')).toContainText('Completed case');
  for (const width of [390, 768, 1440, 1920, 720]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), {
        message: `no horizontal document overflow at ${width} CSS pixels`,
      })
      .toBe(true);
    const name =
      width === 720
        ? 'infrastructure-capstone-200-percent-css-equivalent.png'
        : `infrastructure-capstone-${width}.png`;
    await page.screenshot({ path: testInfo.outputPath(name), fullPage: false });
  }
});

test('first infrastructure lesson has a bounded decoded response and does not eagerly fetch scientific or legacy runtimes', async ({
  page,
}, testInfo) => {
  const urls: string[] = [];
  const responses: Promise<{ bytes: number; injectedSecurity: boolean }>[] = [];
  page.on('request', (request) => urls.push(request.url()));
  page.on('response', (response) => {
    responses.push(
      response
        .body()
        .then((body) => ({
          bytes: body.byteLength,
          // The OS security proxy injects these responses outside the site artifact.
          injectedSecurity: new URL(response.url()).hostname === 'local.adguard.org',
        }))
        .catch(() => ({ bytes: 0, injectedSecurity: false })),
    );
  });
  await page.goto('./?lesson=evidence-load-ledger');
  await expect(page.locator('.infrastructure-course')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(
    urls.filter((url) =>
      /pyodide|engine\.zip|engine-manifest|\.wasm\b|pythonverification|\/api\//i.test(url),
    ),
  ).toEqual([]);
  const measured = await Promise.all(responses);
  const decodedBytes = measured
    .filter((response) => !response.injectedSecurity)
    .reduce((sum, response) => sum + response.bytes, 0);
  await testInfo.attach('infrastructure-load-measurement.json', {
    body: JSON.stringify({
      decodedBytes,
      injectedSecurityBytes: measured
        .filter((response) => response.injectedSecurity)
        .reduce((sum, response) => sum + response.bytes, 0),
      requests: urls.length,
      browser: page.context().browser()?.version(),
      node: process.version,
      viewport: page.viewportSize(),
      conditions: 'Local HTTP preview, fresh browser context, no network or CPU throttling',
    }),
    contentType: 'application/json',
  });
  expect(decodedBytes, 'decoded responses through the first lesson load').toBeLessThan(600_000);
});
