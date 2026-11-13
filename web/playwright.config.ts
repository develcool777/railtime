import { defineConfig, devices } from '@playwright/test';

/** Its own port, so a `pnpm dev` already running (5180) is never mistaken for the build under test. */
const PORT = 5190;
const ORIGIN = `http://localhost:${PORT}`;

/**
 * The site as `deploy.yml` publishes it, `nuxt generate`'s static files, in a real Chromium: what no unit
 * test can show. A city opening on its map, the address written and read back after a reload, playback,
 * the layout at a phone's width. The basemap is a stand-in (`test/support/browser.utils.ts`): no test
 * waits on, or leans on, the tile server.
 */
export default defineConfig({
  testDir: './test/e2e',
  // Not Playwright's default `*.spec.ts`: here `.spec.ts` and `.test.ts` are Vitest's suffixes.
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // Nothing comes from outside the build, so a failure is a real one, which a retry would hide.
  retries: 0,
  // Two: each page runs a WebGL map, and more makes a laptop crawl.
  workers: 2,
  outputDir: 'test-reports/e2e/results',
  reporter: process.env.CI ? [['github'], ['html', { open: 'never', outputFolder: 'test-reports/e2e/html' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: { baseURL: ORIGIN, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off' },
  // One browser: these check the app's wiring, and a second engine would add time, not signal.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The build, not the dev server: the code that ships, served as Cloudflare serves it (`serve.json`:
    // a page's folder at its address with a slash).
    command: `pnpm generate && pnpm exec serve .output/public --config ../../test/e2e/serve.json --listen ${PORT} --no-port-switching`,
    url: ORIGIN,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
