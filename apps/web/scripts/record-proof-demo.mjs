// Record actual, asserted application states; never fabricate a result or speed claim.
import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const url = process.argv[2] || 'http://127.0.0.1:4175/datacenter-twin-lab/';
const output = resolve(root, process.argv[3] || '.local/proof-recording');
await mkdir(output); // Preserve previous recordings by requiring a fresh destination.
const hash = (data) => createHash('sha256').update(data).digest('hex');
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
  recordVideo: { dir: output, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();
const video = page.video();
const started = performance.now();
const cues = [];
const screenshots = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const seconds = () => (performance.now() - started) / 1000;
const cue = (text) => cues.push({ at_s: seconds(), text });
const hold = (ms) => page.waitForTimeout(ms); // Deliberate reading time, never a latency benchmark.
async function capture(name, annotation) {
  const bytes = await page.screenshot({ path: resolve(output, name), animations: 'disabled' });
  screenshots.push({ path: name, annotation, sha256: hash(bytes) });
}
function native(run) {
  return JSON.parse(
    execFileSync(
      process.env.TWIN_PYTHON || 'python',
      [
        '-c',
        'import json,sys;from datacenter_twin.topology import SiteScenario;from datacenter_twin.continuity import simulate_continuity;print(json.dumps(simulate_continuity(SiteScenario.from_dict(json.load(sys.stdin))).to_dict()))',
      ],
      {
        cwd: root,
        input: JSON.stringify(run.scenario),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    ),
  );
}
let result;
try {
  cue('A 1 MW IT load loses utility power. How long can 100 kWh bridge the outage?');
  await page.goto(url);
  await expect(page.getByTestId('guide-run')).toBeVisible();
  await capture(
    'guide-preview.png',
    'The canonical question, three-step route and actual prediction controls.',
  );
  await hold(6500);
  await page.getByTestId('guide-prediction').fill('300');
  cue('Predict 300 seconds FROM the outage. Charging is disabled and the generator is failed.');
  await capture(
    'guide-predict.png',
    '01 Predict: 100 kWh selected; 300-second estimate; no result calculated yet.',
  );
  await hold(6500);
  await page.getByTestId('guide-run').click();
  await expect(page.getByTestId('guide-result')).toContainText('307.8 seconds');
  await page
    .locator('.guided-result-heading')
    .evaluate((element) => element.scrollIntoView({ block: 'start' }));
  cue('Run: 100 × 0.90 × 0.95 = 85.5 kWh delivered to IT. At 1 MW, this lasts 307.8 seconds.');
  await capture(
    'guide-result.png',
    '02 Explain: 307.8 seconds of ride-through; depletion at 607.8 elapsed seconds; the outage ledger.',
  );
  await hold(8000);
  await page.locator('#guided-ledger').scrollIntoViewIfNeeded();
  cue('Outage begins at 300 s; the battery empties at 607.8 s. Utility returns at 900 s.');
  await hold(6500);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export guided run (JSON)' }).click();
  result = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(result).toEqual(native(result));
  cue('Export the complete JSON: exact inputs, input hash, events and interval energy ledger.');
  await hold(4000);
  await page.getByLabel('Verify against Python').check();
  cue('Optional Python verification downloads the reference runtime only when selected.');
  await expect(page.getByTestId('python-verification-status')).toContainText(
    'Exact match with Python',
    { timeout: 90000 },
  );
  await page
    .locator('.guided-result-heading')
    .evaluate((element) => element.scrollIntoView({ block: 'start' }));
  cue(
    'Exact match: all inputs, hashes and calculated values agree with the reference Python engine.',
  );
  await capture(
    'guide-evidence.png',
    '03 Verify: exported input identity and an actual complete-result Python match.',
  );
  await hold(6500);
  await page.getByRole('button', { name: 'Research evidence', exact: true }).click();
  await expect(page.locator('.proof-case')).toHaveCount(3);
  await page.locator('.proof-cases').scrollIntoViewIfNeeded();
  cue(
    'Follow three reproducible cases, reports and review instructions. Teaching evidence, not a facility reliability rating.',
  );
  await hold(Math.max(1500, 60000 - (performance.now() - started)));
  expect(errors).toEqual([]);
} finally {
  await context.close();
  await browser.close();
}
const duration = seconds();
await copyFile(await video.path(), resolve(output, 'proof-demo.webm'));
const timestamp = (value) => {
  const ms = Math.round(value * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};
const captions =
  'WEBVTT\n\n' +
  cues
    .map(
      (item, index) =>
        `${index + 1}\n${timestamp(item.at_s)} --> ${timestamp(cues[index + 1]?.at_s || duration)}\n${item.text}\n`,
    )
    .join('\n');
await writeFile(resolve(output, 'proof-demo.vtt'), captions);
const sources = {};
for (const name of [
  'apps/web/src/App.tsx',
  'apps/web/src/GuidedStart.tsx',
  'apps/web/src/guided-start.css',
  'apps/web/scripts/record-proof-demo.mjs',
])
  sources[name] = hash((await readFile(resolve(root, name))).toString().replaceAll('\r\n', '\n'));
const manifest = {
  kind: 'actual-continuous-browser-recording',
  engine_version: result.engine_version,
  recorded_at: new Date().toISOString(),
  approximate_duration_s: duration,
  note: 'Continuous browser recording. Reading pauses are deliberate; this is not a performance measurement. No audio. Captions follow measured step times. Source files identify the working build, not a released revision.',
  full_native_equality: true,
  optional_python_exact_match: true,
  input_sha256: result.input_sha256,
  run_id: result.run_id,
  source_file_sha256_lf: sources,
  screenshots,
  cues,
  errors,
  video_sha256: hash(await readFile(resolve(output, 'proof-demo.webm'))),
  captions_sha256: hash(await readFile(resolve(output, 'proof-demo.vtt'))),
};
await writeFile(
  resolve(output, 'proof-demo-recording.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    output,
    seconds: duration,
    native_equal: true,
    python_equal: true,
    screenshots: screenshots.length,
  }),
);
