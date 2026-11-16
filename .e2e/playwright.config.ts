// Playwright config for the sale-day E2E spec. CI's `compose` job runs it
// against `docker compose up` (E2E_BASE_URL=http://localhost:3000). Locally:
// `cd .e2e && npm ci`, then `npx playwright test -c playwright.config.ts`. Point
// E2E_CHROMIUM at a system Chromium when Playwright's own browser is not installed.
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
