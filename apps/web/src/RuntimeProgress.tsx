import type { RuntimeProgress as RuntimeProgressState } from './runtime-progress';
import './runtime-progress.css';

const stageLabel: Record<RuntimeProgressState['stage'], string> = {
  starting: 'Starting',
  download: 'Downloading',
  initialize: 'Initializing Python',
  packages: 'Loading packages',
  verify: 'Verifying files',
  calculate: 'Calculating',
  complete: 'Complete',
};

function bytes(value: number) {
  if (value < 1024) return `${value} bytes`;
  const units = ['KiB', 'MiB', 'GiB'];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 0; amount >= 1024 && index < units.length - 1; index++) {
    amount /= 1024;
    unit = units[index + 1];
  }
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${unit}`;
}

export function RuntimeProgress({
  progress,
  testId,
}: {
  progress: RuntimeProgressState | null;
  testId?: string;
}) {
  if (!progress) return null;
  const hasKnownAssetTotal =
    Number.isFinite(progress.totalBytes) &&
    progress.totalBytes! > 0 &&
    Number.isFinite(progress.loadedBytes) &&
    progress.loadedBytes! <= progress.totalBytes!;
  const currentFilePercent = hasKnownAssetTotal
    ? Math.round((progress.loadedBytes! / progress.totalBytes!) * 100)
    : undefined;

  return (
    <div className="runtime-progress" role="status" aria-live="polite" data-testid={testId}>
      <span className={`runtime-progress-stage is-${progress.stage}`} data-stage={progress.stage}>
        {stageLabel[progress.stage]}
      </span>
      <span className="runtime-progress-message">{progress.message}</span>
      {progress.resource && (
        <small className="runtime-progress-resource">{progress.resource}</small>
      )}
      {progress.loadedBytes !== undefined && (
        <div className="runtime-progress-bytes">
          {hasKnownAssetTotal ? (
            <>
              <progress
                aria-label="Current file download"
                aria-valuetext={`${bytes(progress.loadedBytes!)} of ${bytes(progress.totalBytes!)}`}
                value={progress.loadedBytes}
                max={progress.totalBytes}
              />
              <small>
                Current file: {currentFilePercent}% ({bytes(progress.loadedBytes)} of{' '}
                {bytes(progress.totalBytes!)}) · overall total unknown
              </small>
            </>
          ) : (
            <small>{bytes(progress.loadedBytes)} received · overall total unknown</small>
          )}
        </div>
      )}
    </div>
  );
}
