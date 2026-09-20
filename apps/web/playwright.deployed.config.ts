import { defineConfig, devices } from '@playwright/test'
import { isIP } from 'node:net'

const configuredBaseUrl = process.env.RECORD_FINDER_DEPLOYED_BASE_URL

if (!configuredBaseUrl) {
  throw new Error('RECORD_FINDER_DEPLOYED_BASE_URL is required for deployed browser checks')
}

const url = new URL(configuredBaseUrl)
const hostname = url.hostname.replace(/^\[|\]$/g, '')
const publicDnsHostname = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

if (
  url.protocol !== 'https:'
  || !url.hostname
  || isIP(hostname) !== 0
  || !publicDnsHostname.test(hostname)
  || url.hostname.endsWith('.localhost')
  || url.username
  || url.password
  || url.pathname !== '/'
  || url.search
  || url.hash
) {
  throw new Error('RECORD_FINDER_DEPLOYED_BASE_URL must be a clean public HTTPS origin')
}

export default defineConfig({
  testDir: '../../e2e',
  testMatch: 'release-api.spec.ts',
  use: { baseURL: url.origin, trace: 'off' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
})
