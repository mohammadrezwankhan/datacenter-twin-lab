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
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || data.detail || `Request failed (${String(response.status)})`);
  return data;
}
