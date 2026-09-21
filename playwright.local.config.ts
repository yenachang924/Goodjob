import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'local-workspace.spec.ts',
    'fast-capture.spec.ts',
    'fast-time-calendar.spec.ts',
  ],
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5322',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
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
    command: 'npm run dev --workspace @cockpit/web -- --port 5322',
    url: 'http://127.0.0.1:5322',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      COCKPIT_OWNER_ID: '',
    },
  },
});
