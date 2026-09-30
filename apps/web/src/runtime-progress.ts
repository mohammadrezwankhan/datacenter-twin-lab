export type RuntimeStage =
  'starting' | 'download' | 'initialize' | 'packages' | 'verify' | 'calculate' | 'complete';

export type RuntimeProgress = {
  stage: RuntimeStage;
  message: string;
  resource?: string;
  loadedBytes?: number;
  totalBytes?: number;
};

export type ProgressReporter = (progress: RuntimeProgress) => void;

type ArchiveManifest = { archive_sha256?: unknown; archive_bytes?: unknown };

function knownLength(headers: Headers): number | undefined {
  // Fetch exposes decoded response bodies. A content-encoding can make the
  // Content-Length describe a different byte count, so do not use it as a bar.
  if (headers.has('content-encoding')) return undefined;
  const header = headers.get('content-length');
  if (header === null || header.trim() === '') return undefined;
  const value = Number(header);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function throttled(report: ProgressReporter, intervalMs = 100): ProgressReporter {
  const streams = new Map<
    string,
    { last: number; timer?: ReturnType<typeof setTimeout>; pending?: RuntimeProgress }
  >();
  return (progress) => {
    const key = progress.resource ?? progress.stage;
    const state = streams.get(key) ?? { last: 0 };
    streams.set(key, state);
    const now = Date.now();
    const finished = progress.message.startsWith('Downloaded ');
    if (finished || now - state.last >= intervalMs || progress.loadedBytes === undefined) {
      if (state.timer !== undefined) clearTimeout(state.timer);
      state.timer = undefined;
      state.pending = undefined;
      state.last = now;
      report(progress);
      return;
    }
    state.pending = progress;
    if (state.timer !== undefined) return;
    state.timer = setTimeout(
      () => {
        state.timer = undefined;
        if (!state.pending) return;
        state.last = Date.now();
        report(state.pending);
        state.pending = undefined;
      },
      intervalMs - (now - state.last),
    );
  };
}

export async function readResponseBytes(
  response: Response,
  options: {
    stage: RuntimeStage;
    message: string;
    resource: string;
    expectedBytes?: number;
  },
  report: ProgressReporter,
): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error(`${options.resource} download failed (${response.status})`);
  const emit = throttled(report);
  const { expectedBytes, ...displayOptions } = options;
  const expected = expectedBytes ?? knownLength(response.headers);
  const reader = response.body?.getReader();
  if (!reader) {
    emit({ ...displayOptions, loadedBytes: 0, totalBytes: expected });
    const buffer = await response.arrayBuffer();
    emit({
      ...displayOptions,
      message: `Downloaded ${displayOptions.resource}`,
      loadedBytes: buffer.byteLength,
      totalBytes: expected,
    });
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  emit({ ...displayOptions, loadedBytes, totalBytes: expected });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loadedBytes += value.byteLength;
      emit({ ...displayOptions, loadedBytes, totalBytes: expected });
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  }

  const output = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const exactExpected = expected === loadedBytes ? expected : undefined;
  emit({
    ...displayOptions,
    message: `Downloaded ${displayOptions.resource}`,
    loadedBytes,
    totalBytes: exactExpected,
  });
  return output.buffer;
}

export async function fetchVerifiedArchive(
  base: URL,
  prefix: string,
  report: ProgressReporter,
): Promise<ArrayBuffer> {
  const manifestURL = new URL(`${prefix}-manifest.json`, base);
  report({
    stage: 'download',
    message: `Reading ${prefix} source manifest`,
    resource: `${prefix}-manifest.json`,
  });
  const manifestResponse = await fetch(manifestURL);
  if (!manifestResponse.ok) throw new Error(`${prefix} manifest download failed`);
  const manifest = (await manifestResponse.json()) as ArchiveManifest;
  const expectedBytes =
    Number.isSafeInteger(manifest.archive_bytes) && Number(manifest.archive_bytes) >= 0
      ? Number(manifest.archive_bytes)
      : undefined;
  if (
    typeof manifest.archive_sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(manifest.archive_sha256)
  )
    throw new Error(`${prefix} source manifest is invalid`);

  const resource = `${prefix}.zip`;
  report({
    stage: 'download',
    message: `Downloading ${prefix} source archive`,
    resource,
    loadedBytes: 0,
    totalBytes: expectedBytes,
  });
  const archive = await readResponseBytes(
    await fetch(new URL(resource, base)),
    {
      stage: 'download',
      message: `Downloading ${prefix} source archive`,
      resource,
      expectedBytes,
    },
    report,
  );
  report({
    stage: 'verify',
    message: `Checking ${prefix} source archive integrity`,
    resource,
  });
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', archive)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (digest !== manifest.archive_sha256)
    throw new Error(`${prefix} source integrity check failed`);
  return archive;
}

/** Pyodide 314.0.6 has no loadPyodide byte callback. Observe its existing,
 * local runtime fetches during boot/package installation without re-fetching
 * files. Restore the worker's fetch method immediately after initialization. */
export function observeRuntimeFetches(
  runtimeBase: string,
  stage: () => RuntimeStage,
  report: ProgressReporter,
): () => void {
  const originalFetch = self.fetch;
  const nativeFetch = originalFetch.bind(self);
  const root = new URL(runtimeBase, self.location.href);
  const emit = throttled(report);
  self.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: URL;
    try {
      const raw = input instanceof Request ? input.url : String(input);
      url = new URL(raw, self.location.href);
    } catch {
      return nativeFetch(input, init);
    }
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      return nativeFetch(input, init);

    const resource = decodeURIComponent(url.pathname.split('/').pop() || 'runtime file');
    emit({
      stage: stage(),
      message: `Requesting ${resource}; current-file total unknown until response headers arrive`,
      resource,
    });
    const response = await nativeFetch(input, init);
    if (!response.body || response.type === 'opaque') return response;

    const reader = response.body.getReader();
    const totalBytes = knownLength(response.headers);
    let loadedBytes = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            const exactTotal = loadedBytes === totalBytes ? totalBytes : undefined;
            emit({
              stage: stage(),
              message: `Downloaded ${resource}`,
              resource,
              loadedBytes,
              totalBytes: exactTotal,
            });
            return;
          }
          loadedBytes += value.byteLength;
          emit({
            stage: stage(),
            message: `Downloading ${resource}`,
            resource,
            loadedBytes,
            totalBytes,
          });
          controller.enqueue(value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
    // Keep the status, status text, and response headers that Pyodide checks,
    // including application/wasm for instantiateStreaming().
    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
  return () => {
    self.fetch = originalFetch;
  };
}
