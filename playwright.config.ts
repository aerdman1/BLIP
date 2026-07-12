import { defineConfig } from '@playwright/test';

/**
 * BLIP AI QA pipeline — tests run against the PRODUCTION build served by
 * `vite preview` (validates the exact Vercel artifact) with ?test=1 enabling
 * the Test API.
 */
export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // one game at a time — deterministic input timing
  retries: 1,
  outputDir: 'test-results/artifacts',
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 960, height: 540 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
