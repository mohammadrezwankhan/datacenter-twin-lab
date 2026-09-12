type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
};

/** A bounded, cancellable request channel. Workers are created on first use. */
export function createWorkerRequest(createWorker: () => Worker, label: string) {
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
  async function request<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const json = JSON.stringify(body ?? null);
    if (new TextEncoder().encode(json).byteLength > 4 * 1024 * 1024)
      throw new Error('Request exceeds the 4 MiB input limit');
    if (!worker) {
      worker = createWorker();
      worker.onmessage = ({ data }) => {
        const item = pending.get(data.id);
        if (!item) return;
        pending.delete(data.id);
        item.cleanup();
        if (data.error) item.reject(new Error(data.error));
        else item.resolve(data.result);
      };
      worker.onerror = () => stop(new Error(`${label} could not start. Try again or reload.`));
    }
    return new Promise<T>((resolve, reject) => {
      const id = ++sequence;
      const abort = () => {
        const item = pending.get(id);
        pending.delete(id);
        item?.cleanup();
        reject(new DOMException('Cancelled', 'AbortError'));
        if (!pending.size) stop(new DOMException('Cancelled', 'AbortError'));
      };
      const timer = setTimeout(
        () => stop(new Error(`${label} timed out. Try a smaller scenario or retry.`)),
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
  return request;
}
