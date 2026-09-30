import { useEffect, useState } from 'react';
import { compareEmt, type EmtResult } from './engine';
import { RuntimeProgress } from '../RuntimeProgress';
import type { RuntimeProgress as RuntimeProgressState } from '../runtime-progress';

export function EmtVerification({ result }: { result: EmtResult }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState<RuntimeProgressState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setStatus('');
    setProgress(null);
    setError('');
    if (!enabled) return;
    const controller = new AbortController();
    setStatus('Loading the optional Python runtime and checking every sample…');
    setProgress({ stage: 'starting', message: 'Starting the Python reference check' });
    (async () => {
      try {
        const { pythonRequest } = await import('../python-client');
        const reference = await pythonRequest<EmtResult>(
          'emt',
          controller.signal,
          result.config,
          (nextProgress) => {
            if (!controller.signal.aborted) setProgress(nextProgress);
          },
        );
        if (controller.signal.aborted) return;
        const difference = compareEmt(result, reference);
        setStatus(
          `Python agrees across all ${result.rows.length} samples, inputs and summary values. Maximum numeric difference ${difference.toExponential(2)}; absolute tolerance 1e-7 in each stated unit.`,
        );
        setProgress(null);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setStatus('');
          setProgress(null);
          setError((cause as Error).message);
        }
      }
    })();
    return () => controller.abort();
  }, [enabled, result]);
  if (import.meta.env.MODE !== 'demo') return null;
  return (
    <section className="emt-panel" aria-label="Reference Python check">
      <h2>Check the reference implementation</h2>
      <label>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{' '}
        Verify EMT against Python
      </label>
      <p>
        Optional download of about 14 MB. Both engines run on your device. This checks
        implementations of the same ideal circuit; it is not an independent equipment validation.
      </p>
      <RuntimeProgress progress={progress} testId="emt-python-progress" />
      {status && (
        <p role="status" data-testid="emt-python-status">
          {status}
        </p>
      )}
      {error && <p role="alert">{error} Uncheck and check again to retry.</p>}
    </section>
  );
}
