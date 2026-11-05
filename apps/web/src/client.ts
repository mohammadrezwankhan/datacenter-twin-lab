export const n = (value: unknown, digits = 1) =>
  value === null || value === undefined
    ? 'Unknown'
    : Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });

// Keep small-range tick positions distinguishable while retaining compact large scales.
export const powerTickLabel = (value: number, maximum: number) =>
  n(value, maximum < 10 ? 2 : maximum < 100 ? 1 : 0);

export async function request<T>(
  path: string,
  signal?: AbortSignal,
  body?: unknown,
  onProgress?: (progress: import('./runtime-progress').RuntimeProgress) => void,
): Promise<T> {
  if (import.meta.env.MODE === 'demo') {
    const { browserRequest } = await import('./browser-client');
    return browserRequest<T>(path, signal, body, onProgress);
  }
  const response = await fetch(`/api/v1/${path}`, {
    ...(signal === undefined ? {} : { signal }),
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    let message = `Request failed (${String(response.status)})`;
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      const problem = data as Record<string, unknown>;
      if (typeof problem.error === 'string' && problem.error) message = problem.error;
      else if (typeof problem.detail === 'string' && problem.detail) message = problem.detail;
    }
    throw new Error(message);
  }
  // Callers declare the response contract for the selected API route.
  return data as T;
}
