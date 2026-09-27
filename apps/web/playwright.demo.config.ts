import { defineConfig, devices } from '@playwright/test';

const mountPath = process.env.TWIN_DEMO_BASE || '/datacenter-twin-lab/';
if (!/^\/(?:[\w-]+\/)*$/.test(mountPath)) throw new Error('Invalid demo mount path');
const baseURL = `http://127.0.0.1:4174${mountPath}`;
const rootMount = mountPath === '/';

export default defineConfig({
  testDir: './tests-demo',
  workers: 1,
  timeout: 120000,
  expect: { timeout: 90000 },
  retries: process.env.CI ? 1 : 0,
  outputDir: rootMount ? 'test-results-root' : 'test-results',
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: rootMount ? 'playwright-report-root' : 'playwright-report-demo',
        open: 'never',
      },
    ],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport: { width: 1440, height: 1080 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port 4174 --strictPort --mode demo --base ${mountPath}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
