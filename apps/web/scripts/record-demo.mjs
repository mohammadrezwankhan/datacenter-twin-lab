// Capture real, asserted browser states. The GIF uses these unannotated frames.
import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const url = process.argv[2] || 'http://127.0.0.1:4175/datacenter-twin-lab/';
const output = resolve(root, process.argv[3] || '.local/demo-recording');
await mkdir(dirname(output), { recursive: true });
await mkdir(output); // A new output directory prevents overwriting earlier evidence.
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch();
const frames = [];
const failures = [];
const viewport = { width: 1280, height: 960 };
try {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(error.message));
  async function frame(name, description, target = page) {
    if (target === page && frames.length < 5) {
      await page.locator('.demo-stages').evaluate((element) => element.scrollIntoView({ block: 'start' }));
    }
    const path = `${String(frames.length + 1).padStart(2, '0')}-${name}.png`;
    const bytes = await target.screenshot({ path: resolve(output, path), animations: 'disabled' });
    frames.push({ path, description, delay_ms: 3000, sha256: hash(bytes) });
  }
  async function exportRun() {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export run' }).click();
    const download = await pending;
    return JSON.parse(await readFile(await download.path(), 'utf8'));
  }
  function compareNative(run) {
    const native = JSON.parse(execFileSync(process.env.TWIN_PYTHON || 'python', ['-c',
      'import json,sys;from datacenter_twin.topology import SiteScenario;from datacenter_twin.continuity import simulate_continuity;print(json.dumps(simulate_continuity(SiteScenario.from_dict(json.load(sys.stdin))).to_dict()))',
    ], { cwd: root, input: JSON.stringify(run.scenario), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
    expect(run).toEqual(native);
  }
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Battery depleted 607.8 s' })).toBeVisible({ timeout: 90000 });
  await frame('opening', '100 kWh initial reserve; default generator-failure scenario');
  const initial = await exportRun();
  compareNative(initial);
  await page.getByRole('button', { name: 'Battery depleted 607.8 s' }).click();
  await expect(page.getByTestId('served-power')).toHaveText('0 kW');
  await frame('depleted-100', '100 kWh case: IT power is zero after depletion at 607.8 s');
  await page.getByLabel('Initial battery (kWh)').fill('50');
  await frame('edit-reserve', 'Change initial reserve to 50 kWh; completed result still belongs to the previous run');
  await page.getByRole('button', { name: 'Run scenario' }).click();
  await expect(page.getByRole('button', { name: 'Battery depleted 478.3 s' })).toBeVisible();
  const changed = await exportRun();
  compareNative(changed);
  await page.getByRole('button', { name: 'Battery depleted 478.3 s' }).click();
  await expect(page.getByTestId('served-power')).toHaveText('0 kW');
  await frame('depleted-50', '50 kWh case: pre-outage charging shifts depletion to 478.2675 s');
  await page.getByRole('button', { name: 'Utility recovers 900 s' }).click();
  await expect(page.getByTestId('served-power')).toHaveText('1,000 kW');
  await frame('recovery', 'Utility recovers at 900 s and serves 1,000 kW');
  await page.getByRole('button', { name: 'Compare battery reserves' }).click();
  await expect(page.getByTestId('battery-sweep')).toContainText('81.167');
  await page.getByRole('region', { name: 'Reports and sensitivity' }).scrollIntoViewIfNeeded();
  await frame('sensitivity', 'Compare 0, 50, and 100 kWh initial reserves with all other inputs fixed');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download HTML report' }).click();
  const download = await pending;
  const report = await readFile(await download.path(), 'utf8');
  expect(report).toContain(changed.input_sha256);
  const reportPage = await context.newPage();
  await reportPage.setContent(report);
  await frame('report', 'Open the actual exported HTML report with its assumptions and input hash', reportPage);
  expect(failures).toEqual([]);
  const sources = {};
  for (const path of ['apps/web/src/App.tsx', 'apps/web/src/RunTools.tsx', 'apps/web/src/styles.css',
    'apps/web/src/tokens.css', 'apps/web/src/browser-worker.ts', 'apps/web/index.html',
    'apps/web/package-lock.json', 'apps/web/scripts/record-demo.mjs']) {
    sources[path] = hash((await readFile(resolve(root, path))).toString().replaceAll('\r\n', '\n'));
  }
  const manifest = {
    kind: 'actual-browser-step-recording',
    note: 'Unannotated screenshots of real UI states; each held for 3 seconds. Timing omits downloads, waiting and intermediate pointer movement. Not a performance measurement.',
    source_base_revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    source_file_sha256_lf: sources, viewport, frames,
    initial_input_sha256: initial.input_sha256, changed_input_sha256: changed.input_sha256,
    report_sha256: hash(report), full_native_equality: true, browser_errors: failures,
  };
  await writeFile(resolve(output, 'recording.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ output, frames: frames.length, native_equality: true, errors: failures }));
} finally {
  await browser.close();
}
