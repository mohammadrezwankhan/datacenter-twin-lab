import type { PyodideInterface } from 'pyodide';
import {
  fetchVerifiedArchive,
  type RuntimeProgress,
  type RuntimeStage,
  observeRuntimeFetches,
} from './runtime-progress';

let runtime: Promise<PyodideInterface> | undefined;
const waitingIds = new Set<number>();

function report(progress: RuntimeProgress) {
  for (const id of waitingIds) self.postMessage({ id, progress });
}

async function initialize() {
  // Vite emits workers in assets/; runtime files sit beside that directory.
  const base = new URL('../', self.location.href);
  const runtimeURL = new URL('pyodide/', base).href;
  const archive = await fetchVerifiedArchive(base, 'engine', report);
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
    report({
      stage,
      message: 'Installing the verified engine source archive',
      resource: 'engine.zip',
    });
    py.unpackArchive(archive, 'zip', { extractDir: '/home/pyodide' });
    py.runPython('from datacenter_twin.browser import dispatch_json as _bridge_dispatch');
    return py;
  } finally {
    restoreFetch();
  }
}

// Serialize calls because all requests share one Python interpreter.
let queue = Promise.resolve();
self.addEventListener('message', (event: MessageEvent) => {
  const { id, path, body } = event.data;
  waitingIds.add(id);
  queue = queue.then(async () => {
    try {
      report({ stage: 'starting', message: 'Preparing the local Python verification runtime' });
      const py = await (runtime ??= initialize().catch((error) => {
        runtime = undefined;
        throw error;
      }));
      report({ stage: 'calculate', message: 'Running the Python verification calculation' });
      py.globals.set('_request_path', path);
      py.globals.set('_request_json', body);
      const value = py.runPython('_bridge_dispatch(_request_path, _request_json)');
      self.postMessage({ id, result: JSON.parse(value) });
    } catch (error) {
      self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    } finally {
      waitingIds.delete(id);
    }
  });
});
