import { defineConfig } from '@playwright/test';
import control from './playwright.control.config';

export default defineConfig({
  ...control,
  testMatch: ['auth-recovery.spec.ts'],
  timeout: 30000,
  use: { ...control.use, trace: 'off', screenshot: 'off', video: 'off' },
});
