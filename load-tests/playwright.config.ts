import { defineConfig, devices } from '@playwright/test';

// Standalone config — deliberately not apps/web/playwright.config.ts.
// These specs drive real concurrent browser contexts against an
// already-running dev/staging server (this package has no webServer block:
// it never starts or reuses the app's dev server lock, so it can run
// alongside — or instead of — the e2e suite). Point it at a target with:
//   LOAD_TEST_BASE_URL=http://localhost:3002 npx playwright test --config=playwright.config.ts
const baseURL = process.env.LOAD_TEST_BASE_URL ?? 'http://localhost:3002';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
