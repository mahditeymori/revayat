import { defineConfig, devices } from '@playwright/test';

// Loads .env.local the same way scripts/*.ts do (node --env-file=...), but
// from inside config so `npm run test:e2e` works cross-platform without a
// shell-specific flag. Guarded: harmless if the file is absent (e.g. CI with
// real env vars already set).
try {
  process.loadEnvFile('.env.local');
} catch {
  // no .env.local — assume DATABASE_URL etc. are already in the environment
}

// Next's dev server refuses a second concurrent instance (global lock, not
// per-port) — so this points at the same port apps/web's own `dev` script
// normally runs on, rather than spinning up an isolated one, and reuses it
// if it's already up.
const PORT = 3002;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // Fixture data (fixed cart token, fixture order) and admin login-attempt
  // counters are shared across specs — keep runs serial to avoid races.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      // Playwright's own bundled Chromium download is geo-blocked (403) on
      // this network — use the system-installed Google Chrome instead.
      // Scope decision: chromium/Chrome-only, no firefox/webkit — cross-
      // browser coverage wasn't requested.
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
