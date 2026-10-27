import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', timeout: 30000, retries: 0, reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { baseURL: process.env.BASE_URL || 'http://localhost:4173/', trace: 'off' },
  webServer: process.env.BASE_URL ? undefined : { command: 'node scripts/serve.mjs 4173', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'], permissions: ['microphone'],
      launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } } },
  ],
});
