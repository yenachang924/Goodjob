import { defineConfig, devices } from '@playwright/test';

// Non-mutating fixture contexts against the already-running local app.
export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'local-workspace.spec.ts',
    'fast-capture.spec.ts',
    'fast-time-calendar.spec.ts',
  ],
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3000', screenshot: 'off', trace: 'off' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'msedge' },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        defaultBrowserType: 'chromium',
        channel: 'msedge',
      },
    },
  ],
});
