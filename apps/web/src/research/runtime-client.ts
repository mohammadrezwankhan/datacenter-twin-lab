import { createWorkerRequest } from '../worker-request';

// No numerical runtime is loaded until a learner requests a study.
export const researchRequest = createWorkerRequest(
  () => new Worker(new URL('./runtime-worker.ts', import.meta.url), { type: 'module' }),
  'Advanced Python study',
);
