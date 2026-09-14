import { defineConfig } from '@playwright/test';
import base from './playwright.config';

if (
  !process.env.GOODJOB_USERNAME ||
  !process.env.GOODJOB_PASSWORD ||
  !process.env.GOODJOB_API_URL
) {
  throw new Error(
    'Live API test requires GOODJOB_USERNAME, GOODJOB_PASSWORD, and GOODJOB_API_URL. Use a disposable local learning DB.',
  );
}
const api = new URL(process.env.GOODJOB_API_URL);
if (
  api.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(api.hostname)
) {
  throw new Error(
    'Live test only permits a loopback learning API. Never target production data.',
  );
}
export default defineConfig({
  ...base,
  testMatch: 'learning-live.spec.ts',
});
