import type { PyodideInterface } from 'pyodide';

let runtime: Promise<PyodideInterface> | undefined;
async function initialize() {
  const base = new URL('../', self.location.href);
  const runtimeURL = new URL('pyodide/', base).href;
  const { loadPyodide } = await import(/* @vite-ignore */ `${runtimeURL}pyodide.mjs`);
  const py: PyodideInterface = await loadPyodide({ indexURL: runtimeURL });
  for (const prefix of ['engine', 'research']) {
    const [archive, manifest] = await Promise.all([
      fetch(new URL(`${prefix}.zip`, base)).then((r) => {
        if (!r.ok) throw new Error(`${prefix} source download failed`);
        return r.arrayBuffer();
      }),
      fetch(new URL(`${prefix}-manifest.json`, base)).then((r) => {
        if (!r.ok) throw new Error(`${prefix} manifest download failed`);
        return r.json();
      }),
    ]);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', archive)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (digest !== manifest.archive_sha256)
      throw new Error(`${prefix} source integrity check failed`);
    py.unpackArchive(archive, 'zip', { extractDir: '/home/pyodide' });
  }
  // Local, hash-pinned wheels; the locked runtime verifies their digests.
  await py.loadPackage(['numpy', 'scipy']);
  py.runPython('import json\nfrom datacenter_twin.research import run_study as _run_study');
  return py;
}

let queue = Promise.resolve();
self.addEventListener('message', (event: MessageEvent) => {
  const { id, path, body } = event.data;
  queue = queue.then(async () => {
    try {
      if (path !== 'research') throw new Error('Unsupported study operation');
      const py = await (runtime ??= initialize().catch((error) => {
        runtime = undefined;
        throw error;
      }));
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
    }
  });
});
