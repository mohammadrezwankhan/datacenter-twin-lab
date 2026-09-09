type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
};
let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number, Pending>();

function stop(error: Error) {
  worker?.terminate();
  worker = undefined;
  for (const item of pending.values()) {
    item.cleanup();
    item.reject(error);
  }
  pending.clear();
}

export function browserRequest<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  const json = JSON.stringify(body ?? null);
  if (new TextEncoder().encode(json).byteLength > 4 * 1024 * 1024)
    return Promise.reject(new Error('Request exceeds the 4 MiB input limit'));
  if (!worker) {
    worker = new Worker(new URL('./browser-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const item = pending.get(data.id);
      if (!item) return;
      pending.delete(data.id);
      item.cleanup();
      if (data.error) item.reject(new Error(data.error));
      else item.resolve(data.result);
    };
    worker.onerror = () => stop(new Error('Browser Python could not start. Reload to retry.'));
  }
  return new Promise<T>((resolve, reject) => {
    const id = ++sequence;
    const abort = () => {
      const item = pending.get(id);
      pending.delete(id);
      item?.cleanup();
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const timer = setTimeout(
      () => stop(new Error('Browser calculation timed out. Try a smaller scenario or reload.')),
      90_000,
    );
    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
      cleanup: () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      },
    });
    signal?.addEventListener('abort', abort, { once: true });
    worker!.postMessage({ id, path, body: json });
  });
}
