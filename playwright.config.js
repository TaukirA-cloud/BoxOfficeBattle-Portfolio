import { defineConfig } from '@playwright/test';
const channel =
  process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium');
export default defineConfig({
  globalSetup: './browser/setup.js',
  testDir: './browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    ...(channel === 'chromium' ? {} : { channel }),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
