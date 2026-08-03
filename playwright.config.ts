import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['list'],
    ['allure-playwright', { outputFolder: 'allure-results', detail: true }],
    ['./reporters/security-summary-reporter.ts'],
    ['./reporters/failure-context-reporter.ts'],
    ['./reporters/reliability-reporter.ts'],
  ],
  /* Global setup runs once before all tests */
  globalSetup: './global-setup.ts',
  /* Global teardown runs once after all tests - cleans up test data */
  globalTeardown: './global-teardown.ts',
  /* Test timeout: 60 seconds for most tests */
  timeout: 60000,
  /* Expect timeout: 10 seconds for assertions */
  expect: {
    timeout: 10000
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: process.env.BASE_URL ?? 'http://localhost:5001',

    /* Collect trace for all tests. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? 'on-first-retry' : 'on',

    /* Record video on failure for easier debugging */
    video: process.env.CI ? 'retain-on-failure' : 'on-first-failure',

    /* Capture screenshots on failure */
    screenshot: 'only-on-failure',

    /* Network activity logging */
    serviceWorkers: 'allow',

    /* Action timeout: 30 seconds for interactive operations */
    actionTimeout: 30000,

    /* Navigation timeout: 30 seconds for navigation operations */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers - Phase 6: Cross-Browser Support */
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/admin-panel.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'chromium-admin',
      testMatch: '**/admin-panel.spec.ts',
      use: { ...devices['Desktop Chrome'], storageState: 'storage/admin-auth.json' },
    },

    {
      name: 'firefox',
      testIgnore: '**/admin-panel.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      testIgnore: '**/admin-panel.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },

    /* Mobile variants for cross-browser mobile testing */
    {
      name: 'Mobile Chrome',
      testIgnore: '**/admin-panel.spec.ts',
      use: { ...devices['Pixel 5'] },
    },

    {
      name: 'Mobile Safari',
      testIgnore: '**/admin-panel.spec.ts',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
