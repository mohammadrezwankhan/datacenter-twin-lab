export interface WorkerRequest {
  id: number;
  path: string;
  body: string;
}

/** A dedicated worker receives a structured envelope, not arbitrary window messages. */
export function workerRequest(value: unknown): WorkerRequest | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const request = value as Record<string, unknown>;
  if (
    Object.keys(request).some((key) => !['id', 'path', 'body'].includes(key)) ||
    typeof request.id !== 'number' ||
    !Number.isSafeInteger(request.id) ||
    request.id < 0 ||
    typeof request.path !== 'string' ||
    !request.path ||
    typeof request.body !== 'string' ||
    new TextEncoder().encode(request.body).byteLength > 4 * 1024 * 1024
  )
    return undefined;
  return { id: request.id, path: request.path, body: request.body };
}
