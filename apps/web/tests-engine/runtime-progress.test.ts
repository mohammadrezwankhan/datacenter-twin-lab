import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  fetchVerifiedArchive,
  readResponseBytes,
  type RuntimeProgress,
} from '../src/runtime-progress.ts';

function chunks(values: number[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(values.slice(0, 2)));
      controller.enqueue(new Uint8Array(values.slice(2)));
      controller.close();
    },
  });
}

test('archive reader reports actual bytes and a known manifest-sized file total', async () => {
  const states: RuntimeProgress[] = [];
  const bytes = [11, 22, 33, 44];
  const output = await readResponseBytes(
    new Response(chunks(bytes)),
    { stage: 'download', message: 'Downloading source', resource: 'engine.zip', expectedBytes: 4 },
    (state) => states.push(state),
  );

  assert.deepEqual(Array.from(new Uint8Array(output)), bytes);
  assert.ok(states.some((state) => state.loadedBytes === 0 && state.totalBytes === 4));
  assert.deepEqual(states.at(-1), {
    stage: 'download',
    message: 'Downloaded engine.zip',
    resource: 'engine.zip',
    loadedBytes: 4,
    totalBytes: 4,
  });
});

test('compressed, missing, and mismatched lengths never become a byte meter', async () => {
  for (const headers of [{ 'content-length': '4', 'content-encoding': 'gzip' }, {}]) {
    const states: RuntimeProgress[] = [];
    await readResponseBytes(
      new Response(chunks([1, 2, 3, 4]), { headers }),
      { stage: 'download', message: 'Downloading local runtime', resource: 'python_stdlib.zip' },
      (state) => states.push(state),
    );
    assert.ok(states.every((state) => state.totalBytes === undefined));
    assert.ok(states.at(-1)!.loadedBytes! > 0);
  }

  const mismatched: RuntimeProgress[] = [];
  await readResponseBytes(
    new Response(chunks([1, 2, 3, 4])),
    {
      stage: 'download',
      message: 'Downloading local runtime',
      resource: 'pyodide.asm.wasm',
      expectedBytes: 5,
    },
    (state) => mismatched.push(state),
  );
  assert.equal(mismatched.at(-1)?.totalBytes, undefined);
});

test('a failed source download can retry and each attempt requests its files once', async () => {
  const originalFetch = globalThis.fetch;
  const data = new Uint8Array([4, 5, 6]);
  const archiveHash = createHash('sha256').update(data).digest('hex');
  const requested: string[] = [];
  let archiveAttempt = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url.pathname);
    if (url.pathname.endsWith('engine-manifest.json'))
      return Response.json({ archive_sha256: archiveHash, archive_bytes: data.byteLength });
    archiveAttempt += 1;
    if (archiveAttempt === 1) return new Response('offline', { status: 503 });
    return new Response(data, { headers: { 'content-length': String(data.byteLength) } });
  };
  try {
    await assert.rejects(
      fetchVerifiedArchive(new URL('https://local.example/assets/'), 'engine', () => undefined),
      /engine\.zip download failed \(503\)/,
    );
    const states: RuntimeProgress[] = [];
    const retried = await fetchVerifiedArchive(
      new URL('https://local.example/assets/'),
      'engine',
      (state) => states.push(state),
    );
    assert.deepEqual(Array.from(new Uint8Array(retried)), Array.from(data));
    assert.equal(requested.length, 4);
    assert.equal(requested.filter((path) => path.endsWith('engine-manifest.json')).length, 2);
    assert.equal(requested.filter((path) => path.endsWith('engine.zip')).length, 2);
    assert.ok(states.some((state) => state.stage === 'verify'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
