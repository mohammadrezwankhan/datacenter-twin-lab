export const n = (value: unknown, digits = 1) =>
  value === null || value === undefined
    ? 'Unknown'
    : Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });

export async function request<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    signal,
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
    throw new Error(data.error || data.detail || `Request failed (${response.status})`);
  return data;
}
