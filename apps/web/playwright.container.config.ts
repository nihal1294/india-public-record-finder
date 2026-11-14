import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '../../e2e',
  testMatch: 'release-api.spec.ts',
  outputDir: '/tmp/india-public-record-finder-container-playwright',
  use: { baseURL: 'http://127.0.0.1:8766', trace: 'off' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
})
