import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'learning.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5317',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.platform === 'win32' ? 'msedge' : 'chromium',
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        defaultBrowserType: 'chromium',
        channel: process.platform === 'win32' ? 'msedge' : 'chromium',
      },
    },
  ],
  webServer: {
    env: { GOODJOB_WEB_ORIGIN: 'http://127.0.0.1:5317' },
    command: 'npm run dev --workspace @cockpit/web -- --port 5317',
    url: 'http://127.0.0.1:5317',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
