import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

/** Smoke coverage only – the interaction rules live in the Vitest specs. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        // The design frame: 390 x 844, touch-first.
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
        // A sandbox with a preinstalled Chromium of another revision points here
        // instead of running `playwright install`; unset, Playwright's own is used.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port ' + PORT,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
