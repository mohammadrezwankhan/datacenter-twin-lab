import { createWorkerRequest } from './worker-request';

// The interactive path never imports or starts the optional Python runtime.
export const browserRequest = createWorkerRequest(
  () => new Worker(new URL('./javascript-worker.ts', import.meta.url), { type: 'module' }),
  'Browser calculation',
);
