// Playwright config for the sale-day E2E spec. Not wired into CI yet (see
// docs/ROADMAP.md). Point E2E_CHROMIUM at a system Chromium when Playwright's
// own browser is not installed.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5187',
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
