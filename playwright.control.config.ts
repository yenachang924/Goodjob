import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['project-control.spec.ts', 'editor-regression.spec.ts'],
  workers: 1,
  timeout: 60000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:5321',
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
        channel: process.platform === 'win32' ? 'msedge' : 'chromium',
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/support/supabase-fixture.mjs',
      url: 'http://127.0.0.1:55439/health',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'node node_modules/next/dist/bin/next dev apps/web --port 5321',
      url: 'http://127.0.0.1:5321',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55439',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key',
        COCKPIT_OWNER_ID: '11111111-1111-4111-8111-111111111111',
        COCKPIT_WEB_ORIGIN: 'http://127.0.0.1:5321',
      },
    },
  ],
});
