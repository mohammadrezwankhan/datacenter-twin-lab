import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 } },
    },
  ],
  webServer: {
    command: `"${process.env.TWIN_PYTHON || 'python'}" -m datacenter_twin serve --port 8000`,
    cwd: '../..',
    url: 'http://127.0.0.1:8000/api/v1/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
