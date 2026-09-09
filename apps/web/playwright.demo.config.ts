import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests-demo',
  workers: 1,
  timeout: 120000,
  expect: { timeout: 90000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-demo', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4174/datacenter-twin-lab/',
    viewport: { width: 1440, height: 1080 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4174 --strictPort --mode demo',
    url: 'http://127.0.0.1:4174/datacenter-twin-lab/',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
