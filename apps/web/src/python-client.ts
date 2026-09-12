import { createWorkerRequest } from './worker-request';

// Imported only after the visitor enables Python verification.
export const pythonRequest = createWorkerRequest(
  () => new Worker(new URL('./browser-worker.ts', import.meta.url), { type: 'module' }),
  'Python verification',
);
