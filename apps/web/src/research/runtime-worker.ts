import type { PyodideInterface } from 'pyodide';
import {
  fetchVerifiedArchive,
  observeRuntimeFetches,
  type RuntimeProgress,
  type RuntimeStage,
} from '../runtime-progress';

let runtime: Promise<PyodideInterface> | undefined;
const waitingIds = new Set<number>();

function report(progress: RuntimeProgress) {
  for (const id of waitingIds) self.postMessage({ id, progress });
}

async function initialize() {
  const base = new URL('../', self.location.href);
  const runtimeURL = new URL('pyodide/', base).href;
  const archives: Array<{ name: string; data: ArrayBuffer }> = [];
  for (const name of ['engine', 'research']) {
    archives.push({ name, data: await fetchVerifiedArchive(base, name, report) });
  }

  let stage: RuntimeStage = 'initialize';
  const restoreFetch = observeRuntimeFetches(runtimeURL, () => stage, report);
  try {
    const { loadPyodide } = await import(/* @vite-ignore */ `${runtimeURL}pyodide.mjs`);
    stage = 'download';
    report({ stage, message: 'Downloading Pyodide runtime files; overall download total unknown' });
    const py: PyodideInterface = await loadPyodide({ indexURL: runtimeURL });
    stage = 'initialize';
    report({ stage, message: 'Finishing local Python interpreter initialization' });
    stage = 'verify';
    for (const archive of archives) {
      report({
        stage,
        message: `Installing the verified ${archive.name} source archive`,
        resource: `${archive.name}.zip`,
      });
      py.unpackArchive(archive.data, 'zip', { extractDir: '/home/pyodide' });
    }
    stage = 'packages';
    report({ stage, message: 'Loading the pinned NumPy and SciPy wheels' });
    // In Pyodide 314.0.6 the callback reports package work by phase. The
    // worker fetch wrapper supplies byte counts for actual local wheel reads.
    await py.loadPackage(['numpy', 'scipy'], {
      messageCallback: (message) => report({ stage, message }),
    });
    py.runPython('import json\nfrom datacenter_twin.research import run_study as _run_study');
    return py;
  } finally {
    restoreFetch();
  }
}

let queue = Promise.resolve();
self.addEventListener('message', (event: MessageEvent) => {
  const { id, path, body } = event.data;
  waitingIds.add(id);
  queue = queue.then(async () => {
    try {
      if (path !== 'research') throw new Error('Unsupported study operation');
      report({ stage: 'starting', message: 'Preparing the local scientific runtime' });
      const py = await (runtime ??= initialize().catch((error) => {
        runtime = undefined;
        throw error;
      }));
      report({ stage: 'calculate', message: 'Calculating the configured research study' });
      py.globals.set('_study_request_json', body);
      const result = py.runPython(
        [
          '_request = json.loads(_study_request_json)',
          'if not isinstance(_request, dict) or set(_request) != {"study", "config"}: raise ValueError("Expected study and config")',
          'json.dumps(_run_study(_request["study"], _request["config"]), allow_nan=False)',
        ].join('\n'),
      );
      self.postMessage({ id, result: JSON.parse(result) });
    } catch (error) {
      self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    } finally {
      waitingIds.delete(id);
    }
  });
});
