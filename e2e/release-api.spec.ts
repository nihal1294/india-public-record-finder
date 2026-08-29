import { expect, test, type Page } from '@playwright/test'

const manifestIds = [
  ...'ABCDEFGHIJK'.split('').map((suffix) => `SYN-KA-${suffix}`),
  ...Array.from({ length: 109 }, (_, index) => `SYN-KA-${String(index + 12).padStart(3, '0')}`),
]

async function expectCleanSearchUrl(page: Page) {
  const url = new URL(page.url())
  expect(url.pathname).toBe('/')
  expect(url.search).toBe('')
  expect(url.hash).toBe('')
}

async function expectSameOriginImageAsset(
  page: Page,
  selector: string,
  type: string,
  sizes: string,
  contentType: RegExp,
) {
  const link = page.locator(selector)
  await expect(link).toHaveCount(1)
  await expect(link).toHaveAttribute('type', type)
  await expect(link).toHaveAttribute('sizes', sizes)
  const href = await link.getAttribute('href')
  expect(href).not.toBeNull()
  const assetUrl = new URL(href!, page.url())
  expect(assetUrl.origin, `${selector} must be same-origin`).toBe(new URL(page.url()).origin)
  const response = await page.request.get(assetUrl.toString())
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(contentType)
}

test('runs all fictional examples through the read-only service', async ({ page, context, request }) => {
  const healthResponse = await request.get('/healthz')
  expect(healthResponse.status()).toBe(200)
  expect(healthResponse.headers()['cache-control']).toBe('no-store')
  await expect(healthResponse.json()).resolves.toEqual({ status: 'ready' })
  const fontResponse = page.waitForResponse((response) => response.url().endsWith('/fonts/noto-sans-kannada/NotoSansKannada-Regular.ttf'))
  await page.goto('/')
  await expectSameOriginImageAsset(
    page,
    'link[rel="icon"]',
    'image/svg+xml',
    'any',
    /^image\/svg\+xml(?:;|$)/,
  )
  await expectSameOriginImageAsset(
    page,
    'link[rel="apple-touch-icon"]',
    'image/png',
    '180x180',
    /^image\/png(?:;|$)/,
  )
  await expect((await fontResponse).status()).toBe(200)
  await expect(page.evaluate(async () => {
    await document.fonts.ready
    return document.fonts.check('16px "Noto Sans Kannada"')
  })).resolves.toBe(true)
  await page.getByRole('button', { name: 'Use example: Exact Kannada' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByRole('heading', { name: 'ಅನನ್ಯಾ ಗೌಡ / Ananya Gowda' })).toBeVisible()
  await expect(page.getByText('1 possible match')).toBeVisible()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByAltText('Synthetic source crop')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open larger view' })).toBeVisible()
  await page.getByRole('button', { name: 'Open larger view' }).click()
  await expect(page.getByRole('dialog', { name: 'Synthetic source crop' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'About' }).click()
  await expect(page.getByRole('dialog', { name: 'About this demo' })).toBeVisible()
  await expect(page.getByText('Only the synthetic Karnataka SIR profile works today.')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Use example: Romanized spelling variation' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByRole('heading', { name: 'ಅನನ್ಯಾ ಗೌಡ / Ananya Gowda' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Use example: Needs refinement' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByText('Needs more detail')).toBeVisible()
  await page.getByRole('button', { name: 'Edit search' }).click()
  await page.getByLabel("Relative's name (optional)").fill('Sunil Nayak')
  await page.getByLabel('Locality (optional)').fill('Beluru')
  await page.getByLabel('Age in roll year (optional)').fill('31')
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByRole('heading', { name: 'ಕಾವ್ಯ ನಾಯಕ್ / Kavya Nayak' })).toBeVisible()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByAltText('Synthetic source crop')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Use example: No confident match' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByText('We could not find a confident result.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Verify source' })).toHaveCount(0)
  await expectCleanSearchUrl(page)
  await expect(page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).resolves.toEqual({ local: 0, session: 0 })
  await expect(context.cookies()).resolves.toEqual([])
})

test('loads the real 120-record catalog and transfers a non-curated sample only after explicit submit', async ({ page, context }) => {
  let searchRequests = 0
  page.on('request', (request) => { if (request.url().endsWith('/api/search')) searchRequests += 1 })
  const catalogResponse = page.waitForResponse((response) => response.url().endsWith('/api/demo/records') && response.status() === 200)
  await page.goto('/demo-data')
  await expect((await catalogResponse).ok()).toBe(true)
  await expect(page.getByText('Judge-only test bench. Every record is fictional. A production service containing real records must not offer browse-all access.')).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(21)
  await expect(page.getByRole('cell', { name: 'SYN-KA-A', exact: true })).toBeVisible()
  await expect(page.evaluate(() => {
    const warning = document.querySelector('.demo-warning')
    const firstCell = document.querySelector('.demo-record-table tbody td')
    return Boolean(warning && firstCell && (warning.compareDocumentPosition(firstCell) & Node.DOCUMENT_POSITION_FOLLOWING))
  })).resolves.toBe(true)
  const displayedIds: string[] = []
  for (let pageNumber = 1; pageNumber <= 6; pageNumber += 1) {
    const start = (pageNumber - 1) * 20 + 1
    const end = pageNumber * 20
    await expect(page.getByText(`Showing ${start}-${end} of 120 records`)).toBeVisible()
    await expect(page.getByText(`Page ${pageNumber} of 6`)).toBeVisible()
    displayedIds.push(...await page.locator('.demo-record-table tbody tr td:first-child').allTextContents())
    if (pageNumber < 6) await page.getByRole('button', { name: 'Next page' }).click()
  }
  expect(displayedIds).toEqual(manifestIds)
  expect(new Set(displayedIds).size).toBe(120)
  await expect(page.getByRole('cell', { name: 'SYN-KA-120', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await page.getByLabel('Filter fictional records').fill('SYN-KA-012')
  const row = page.getByRole('row').filter({ hasText: 'SYN-KA-012' })
  await expect(row).toHaveCount(1)
  const cells = await row.getByRole('cell').allTextContents()
  await page.getByRole('button', { name: 'Use this sample: SYN-KA-012' }).click()

  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(cells[1])
  await expect(page.getByLabel("Relative's name (optional)")).toHaveValue(cells[3])
  await expect(page.getByLabel('Locality (optional)')).toHaveValue(cells[5])
  await expect(page.getByLabel('Age in roll year (optional)')).toHaveValue(cells[7])
  expect(searchRequests).toBe(0)
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect.poll(() => searchRequests).toBe(1)
  await expectCleanSearchUrl(page)
  await expect(page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).resolves.toEqual({ local: 0, session: 0 })
  await expect(context.cookies()).resolves.toEqual([])
})

test('recovers stale browser routes without turning API or asset misses into documents', async ({ page, request }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  const recoveredDocument = await page.goto('/stale-shared-route?stale=1#top')
  expect(recoveredDocument?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Find a record. Verify the source.' })).toBeVisible()
  await expectCleanSearchUrl(page)
  expect(consoleErrors).toEqual([])

  await page.goto('/demo-data/?stale=1#top')
  await expect(page.getByText('Judge-only test bench. Every record is fictional. A production service containing real records must not offer browse-all access.')).toBeVisible()
  const demoUrl = new URL(page.url())
  expect(demoUrl.pathname).toBe('/demo-data')
  expect(demoUrl.search).toBe('')
  expect(demoUrl.hash).toBe('')

  const unknownApi = await request.get('/api/not-a-route')
  expect(unknownApi.status()).toBe(404)
  expect(unknownApi.headers()['content-type']).toMatch(/^application\/json(?:;|$)/)
  await expect(unknownApi.json()).resolves.toEqual({ detail: 'not found' })

  for (const apiPath of ['/api', '/api/']) {
    const apiDocumentRequest = await request.get(apiPath, { headers: { accept: 'text/html' } })
    expect(apiDocumentRequest.status()).toBe(404)
    expect(apiDocumentRequest.headers()['cache-control']).toBe('no-store')
    expect(apiDocumentRequest.headers()['content-type']).toMatch(/^application\/json(?:;|$)/)
    await expect(apiDocumentRequest.json()).resolves.toEqual({ detail: 'not found' })
  }

  const missingAsset = await request.get('/missing.js')
  expect(missingAsset.status()).toBe(404)
  expect(missingAsset.headers()['content-type']).toMatch(/^application\/json(?:;|$)/)
  await expect(missingAsset.json()).resolves.toEqual({ detail: 'not found' })

  const nonGet = await request.post('/stale-shared-route')
  expect(nonGet.status()).toBe(404)
  expect(nonGet.headers()['content-type']).toMatch(/^application\/json(?:;|$)/)
  await expect(nonGet.json()).resolves.toEqual({ detail: 'not found' })
})
