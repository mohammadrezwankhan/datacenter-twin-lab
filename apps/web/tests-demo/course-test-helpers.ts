import { expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export async function expectSceneLabelsVisible(page: Page) {
  const clipped = await page.locator('.lesson-scene-svg').evaluate((svg) => {
    const frame = svg.getBoundingClientRect();
    return [...svg.querySelectorAll('text')]
      .filter((text) => {
        const rect = text.getBoundingClientRect();
        return (
          rect.left < frame.left - 1 ||
          rect.right > frame.right + 1 ||
          rect.top < frame.top - 1 ||
          rect.bottom > frame.bottom + 1
        );
      })
      .map((text) => text.textContent);
  });
  expect(clipped, 'Every scene label must fit inside its visible diagram').toEqual([]);
}

export async function exported(page: Page, planning = false): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page
    .getByRole('button', { name: planning ? 'Export PUE calculation' : 'Export lesson run' })
    .click();
  const value: unknown = JSON.parse(await readFile(await (await pending).path(), 'utf8'));
  return value;
}

function runObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('A native comparison requires a run object');
  return value as Record<string, unknown>;
}

export function nativeRun(input: unknown): unknown {
  const run = runObject(input);
  if (run.schema_version !== 1 && run.schema_version !== 2)
    throw new TypeError('A native comparison requires planning schema 1 or continuity schema 2');
  const planning = run.schema_version === 1;
  const modelInput = runObject(planning ? run.assumptions : run.scenario);
  const result: unknown = JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      [
        '-c',
        planning
          ? 'import json,sys;from datacenter_twin.contracts import Scenario;from datacenter_twin.engine import simulate;print(json.dumps(simulate(Scenario.from_dict(json.load(sys.stdin)))))'
          : 'import json,sys;from datacenter_twin.topology import SiteScenario;from datacenter_twin.continuity import simulate_continuity;print(json.dumps(simulate_continuity(SiteScenario.from_dict(json.load(sys.stdin))).to_dict()))',
      ],
      {
        cwd: '../..',
        input: JSON.stringify(modelInput),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    ),
  );
  const native = runObject(result);
  if (native.schema_version !== run.schema_version || typeof native.run_id !== 'string')
    throw new TypeError('The native process returned an unexpected run shape');
  return result;
}
