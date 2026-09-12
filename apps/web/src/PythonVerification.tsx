import { useEffect, useState } from 'react';
import type { Run } from './types';

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, ordered(child)]),
    );
  return value;
}

type PlanningVerification = {
  schema_version: 1;
  run_id: string;
  assumptions: Record<string, unknown>;
};
export function PythonVerification({ run }: { run: Run | PlanningVerification }) {
  const [enabled, setEnabled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setStatus('');
    setError('');
    if (!enabled) return;
    const controller = new AbortController();
    setStatus('Loading Python on request and checking this completed run…');
    (async () => {
      try {
        const { pythonRequest } = await import('./python-client');
        const reference = await pythonRequest<unknown>(
          run.schema_version === 1 ? 'planning' : 'simulations',
          controller.signal,
          run.schema_version === 1 ? run.assumptions : run.scenario,
        );
        if (controller.signal.aborted) return;
        if (JSON.stringify(ordered(reference)) !== JSON.stringify(ordered(run)))
          throw new Error(
            'JavaScript and Python results differ. Export this run and report the mismatch.',
          );
        setStatus(
          `Exact match with Python: all inputs, hashes and calculated values (${run.run_id}).`,
        );
      } catch (cause) {
        if (!controller.signal.aborted) {
          setStatus('');
          setError((cause as Error).message);
        }
      }
    })();
    return () => controller.abort();
  }, [enabled, attempt, run]);
  return (
    <section className="panel python-verification" aria-label="Optional Python verification">
      <label>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Verify against Python
      </label>
      <p>
        Optional: downloads about 14 MB the first time. Your existing result stays available; the
        reference Python engine also runs on your device.
      </p>
      {status && (
        <p role="status" data-testid="python-verification-status">
          {status}
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((value) => value + 1)}>
            Retry Python verification
          </button>
        </div>
      )}
    </section>
  );
}
