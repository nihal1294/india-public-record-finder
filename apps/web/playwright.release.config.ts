import { defineConfig, devices } from '@playwright/test'

const modelCache = process.env.RECORD_FINDER_TEST_MODEL_CACHE

if (!modelCache) {
  throw new Error('RECORD_FINDER_TEST_MODEL_CACHE is required for release browser checks')
}

function quote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export default defineConfig({
  testDir: '../../e2e',
  testMatch: 'release-api.spec.ts',
  outputDir: '/tmp/india-public-record-finder-release-playwright',
  use: { baseURL: 'http://127.0.0.1:8766', trace: 'off' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: `pnpm build && uv run record-finder serve --snapshot ../../data/synthetic/demo-v1/manifest.json --model-cache ${quote(modelCache)} --model-manifest ../../models/manifest.json --web-root dist --host 127.0.0.1 --port 8766`,
    url: 'http://127.0.0.1:8766/healthz',
    reuseExistingServer: false,
  },
})
