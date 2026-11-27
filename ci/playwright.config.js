const path = require('path')

// The stack exports these; the defaults let `npx playwright test` work from
// this directory when a Nextcloud instance is already listening on 8290.
const version = process.env.NEXTCLOUD_VERSION || '29-apache'
const state = process.env.CI_STATE || 'default'
const baseURL = process.env.BASE_URL || 'http://localhost:8290'

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL,
    browserName: 'firefox',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      stylePath: path.join(__dirname, 'screenshot.css'),
      // The browser is pinned in a container, so baselines are stable. The
      // small allowance covers font hinting differences inside the container.
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    },
  },

  // Baselines are separated by Nextcloud version and by the configuration
  // state that run.sh applies with occ before starting Firefox.
  snapshotPathTemplate:
    '{testDir}/../baselines/' + version + '/' + state + '/{arg}-{projectName}{ext}',

  // Never create a baseline implicitly in CI: a missing image is a failure.
  updateSnapshots: 'none',

  projects: [{ name: 'firefox' }],
}
