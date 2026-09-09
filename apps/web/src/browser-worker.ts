import type { PyodideInterface } from 'pyodide';

let runtime: Promise<PyodideInterface> | undefined;
async function initialize() {
  const base = new URL(import.meta.env.BASE_URL, self.location.origin);
  const runtimeURL = new URL('pyodide/', base).href;
  const { loadPyodide } = await import(/* @vite-ignore */ `${runtimeURL}pyodide.mjs`);
  const py: PyodideInterface = await loadPyodide({ indexURL: runtimeURL });
  const [archive, manifest] = await Promise.all([
    fetch(new URL('engine.zip', base)).then((r) => {
      if (!r.ok) throw new Error('Engine download failed');
      return r.arrayBuffer();
    }),
    fetch(new URL('engine-manifest.json', base)).then((r) => {
      if (!r.ok) throw new Error('Engine manifest download failed');
      return r.json();
    }),
  ]);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', archive)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (digest !== manifest.archive_sha256) throw new Error('Engine archive integrity check failed');
  py.unpackArchive(archive, 'zip', { extractDir: '/home/pyodide' });
  py.runPython('from datacenter_twin.browser import dispatch_json as _bridge_dispatch');
  return py;
}

// Serialize calls because all requests share one Python interpreter.
let queue = Promise.resolve();
self.addEventListener('message', (event: MessageEvent) => {
  const { id, path, body } = event.data;
  queue = queue.then(async () => {
    try {
      const py = await (runtime ??= initialize());
      py.globals.set('_request_path', path);
      py.globals.set('_request_json', body);
      const value = py.runPython('_bridge_dispatch(_request_path, _request_json)');
      self.postMessage({ id, result: JSON.parse(value) });
    } catch (error) {
      self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    }
  });
});
