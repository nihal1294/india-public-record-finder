import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const evidenceCrop = readFileSync(resolve(process.cwd(), '../../data/synthetic/demo-v1/evidence/evidence-SYN-KA-A.png'))

const examples = [
  { id: 'exact-kannada', label: 'Exact Kannada', query: { name: 'ಅನನ್ಯಾ ಗೌಡ', relative_name: 'ರಮೇಶ್ ಗೌಡ', locality: 'ಚೆನ್ನಾಪುರ', age: 28 }, expected_state: 'possible_match', expected_record_id: 'SYN-KA-A' },
  { id: 'romanized-typo', label: 'Romanized typo', query: { name: 'Ananya Gowdaa', relative_name: 'Ramesh Gowda', locality: 'Chennapura', age: 28 }, expected_state: 'possible_match', expected_record_id: 'SYN-KA-A' },
  { id: 'needs-refinement', label: 'Needs refinement', query: { name: 'Kavya Nayak' }, refinement: { relative_name: 'Sunil Nayak', locality: 'Beluru', age: 31 }, expected_state: 'needs_more_detail', expected_refined_state: 'possible_match', expected_record_id: 'SYN-KA-C' },
  { id: 'no-confident-match', label: 'No confident match', query: { name: 'Nandini Meridian', locality: 'Imaginary Nagar' }, expected_state: 'no_confident_result' },
] as const

const ananya = {
  synthetic_id: 'SYN-KA-A', name: 'ಅನನ್ಯಾ ಗೌಡ', latin_name: 'Ananya Gowda', relative_name: 'Ramesh Gowda', locality: 'Chennapura', age: 28, evidence_id: 'evidence-syn-ka-a', source_part: 'KA-01', source_page: 1,
  match_reasons: [{ field: 'Name', value: 'Ananya Gowda', match: 'Close match' }, { field: "Relative's name", value: 'Ramesh Gowda', match: 'Exact match' }, { field: 'Locality', value: 'Chennapura', match: 'Exact match' }],
}
const kavya = { ...ananya, synthetic_id: 'SYN-KA-C', name: 'ಕಾವ್ಯಾ ನಾಯಕ್', latin_name: 'Kavya Nayak', relative_name: 'Sunil Nayak', locality: 'Beluru', age: 31, evidence_id: 'evidence-syn-ka-c' }
const demoIds = [...'ABCDEFGHIJK'.split('').map((suffix) => `SYN-KA-${suffix}`), ...Array.from({ length: 109 }, (_, index) => `SYN-KA-${String(index + 12).padStart(3, '0')}`)]
const demoRecords = demoIds.map((synthetic_id, index) => ({
  synthetic_id, name: `ಹೆಸರು ${index + 1}`, latin_name: `Name ${index + 1}`, relative_name: `ಸಂಬಂಧಿ ${index + 1}`, latin_relative_name: `Relative ${index + 1}`,
  relationship: 'father', locality: `ಊರು ${index + 1}`, latin_locality: `Locality ${index + 1}`, age: 20 + (index % 50), evidence_id: `evidence-${synthetic_id}`, source_part: `KA-${String((index % 6) + 1).padStart(2, '0')}`, source_page: index + 1,
}))

async function installMockApi(page: Page) {
  await page.route('**/api/examples', (route) => route.fulfill({ json: examples }))
  await page.route('**/api/demo/records', (route) => route.fulfill({ json: demoRecords }))
  await page.route('**/api/search', async (route) => {
    const query = route.request().postDataJSON() as { name: string; relative_name?: string }
    const payload = query.name === 'Nandini Meridian'
      ? { state: 'no_confident_result', candidates: [] }
      : query.name === 'Kavya Nayak' && !query.relative_name
        ? { state: 'needs_more_detail', candidates: [kavya] }
        : { state: 'possible_match', candidates: [query.name === 'Kavya Nayak' ? kavya : ananya] }
    await route.fulfill({ json: payload })
  })
  await page.route('**/api/evidence/*', (route) => route.fulfill({ contentType: 'image/png', body: evidenceCrop }))
}

test.beforeEach(async ({ page }) => { await installMockApi(page) })

test('prefills then explicitly submits all four fictional examples without persisting a query', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Use example: Exact Kannada' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByRole('heading', { name: 'ಅನನ್ಯಾ ಗೌಡ / Ananya Gowda' })).toBeVisible()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByAltText('Synthetic source crop')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Use example: Romanized spelling variation' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByRole('heading', { name: 'Possible matches' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Use example: Needs refinement' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByText('Needs more detail')).toBeVisible()
  await page.getByRole('button', { name: 'Edit search' }).click()
  await page.getByLabel("Relative's name (optional)").fill('Sunil Nayak')
  await page.getByLabel('Locality (optional)').fill('Beluru')
  await page.getByLabel('Age in roll year (optional)').fill('31')
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByAltText('Synthetic source crop')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Use example: No confident match' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByText('We could not find a confident result.')).toBeVisible()
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  await expect(page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).resolves.toEqual({ local: 0, session: 0 })
})

test('has no horizontal overflow at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})

test('keeps explorer table semantics, warning order, and Kannada handoff at the 360px 200-percent-zoom narrow equivalent', async ({ page, context }) => {
  let searchRequests = 0
  page.on('request', (request) => { if (request.url().endsWith('/api/search')) searchRequests += 1 })
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/demo-data')
  const table = page.getByRole('table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader')).toHaveCount(11)
  await expect(table.getByRole('row')).toHaveCount(21)
  await expect(page.getByRole('cell', { name: /^Synthetic ID SYN-KA-A$/ })).toBeVisible()
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
  await expect(page.evaluate(() => {
    const warning = document.querySelector('.demo-warning')
    const firstCell = document.querySelector('.demo-record-table tbody td')
    return Boolean(warning && firstCell && (warning.compareDocumentPosition(firstCell) & Node.DOCUMENT_POSITION_FOLLOWING))
  })).resolves.toBe(true)

  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Switch to Kannada' }).click()
  await expect(page.getByRole('heading', { name: 'ಕೃತಕ ಡೆಮೊ ದಾಖಲೆಗಳು' })).toBeVisible()
  await page.getByRole('button', { name: 'ಈ ಮಾದರಿಯನ್ನು ಬಳಸಿ: SYN-KA-A' }).click()
  await expect(page.getByLabel('ಹೆಸರು', { exact: true })).toHaveValue('ಹೆಸರು 1')
  await expect(page.getByLabel('ಸಂಬಂಧಿಯ ಹೆಸರು (ಐಚ್ಛಿಕ)')).toHaveValue('ಸಂಬಂಧಿ 1')
  await expect(page.getByLabel('ಊರು, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ (ಐಚ್ಛಿಕ)')).toHaveValue('ಊರು 1')
  await expect(page.getByLabel('ಮತದಾರರ ಪಟ್ಟಿಯ ವರ್ಷದ ವಯಸ್ಸು (ಐಚ್ಛಿಕ)')).toHaveValue('20')
  expect(searchRequests).toBe(0)
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  await expect(page.evaluate(() => ({ language: document.documentElement.lang, local: localStorage.length, session: sessionStorage.length }))).resolves.toEqual({ language: 'kn', local: 0, session: 0 })
  await expect(context.cookies()).resolves.toEqual([])
})

test('navigation keeps demo data and browser history query-free', async ({ page }) => {
  await page.goto('/demo-data')
  await expect(page.getByRole('heading', { name: 'Synthetic demo records' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'SYN-KA-A', exact: true })).toBeVisible()
  expect(new URL(page.url())).toMatchObject({ pathname: '/demo-data', search: '', hash: '' })

  await page.getByRole('button', { name: 'India Public Record Finder' }).click()
  await expect(page.getByRole('heading', { name: 'Find a record. Verify the source.' })).toBeVisible()
  expect(new URL(page.url())).toMatchObject({ pathname: '/', search: '', hash: '' })
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Synthetic demo records' })).toBeVisible()
  expect(new URL(page.url())).toMatchObject({ pathname: '/demo-data', search: '', hash: '' })
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Find a record. Verify the source.' })).toBeVisible()
  expect(new URL(page.url())).toMatchObject({ pathname: '/', search: '', hash: '' })
})

test('explores all mocked fictional records and pre-fills a non-curated sample without searching', async ({ page }) => {
  let searchRequests = 0
  page.on('request', (request) => { if (request.url().endsWith('/api/search')) searchRequests += 1 })
  await page.goto('/demo-data')
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(21)
  for (let pageNumber = 1; pageNumber < 6; pageNumber += 1) await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText('Showing 101-120 of 120 records')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'SYN-KA-120', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await page.getByLabel('Filter fictional records').fill('SYN-KA-012')
  await expect(page.getByText('Showing 1-1 of 1 records')).toBeVisible()
  await page.getByRole('button', { name: 'Use this sample: SYN-KA-012' }).click()

  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('ಹೆಸರು 12')
  await expect(page.getByLabel("Relative's name (optional)")).toHaveValue('ಸಂಬಂಧಿ 12')
  await expect(page.getByLabel('Locality (optional)')).toHaveValue('ಊರು 12')
  await expect(page.getByLabel('Age in roll year (optional)')).toHaveValue('31')
  expect(searchRequests).toBe(0)
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect.poll(() => searchRequests).toBe(1)
  expect(new URL(page.url())).toMatchObject({ pathname: '/', search: '', hash: '' })
})

test('mobile navigation menu is expandable and dismissible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')

  const menu = page.getByRole('button', { name: 'Menu' })
  const browse = page.getByRole('button', { name: 'Browse fictional demo data' })
  await expect(menu).toBeVisible()
  await expect(browse).toBeHidden()
  await menu.click()
  await expect(browse).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(browse).toBeHidden()
})

test('keeps About and enlarged synthetic evidence keyboard-accessible without changing the URL', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'About' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'About this demo' })).toBeVisible()
  await expect(page.getByText(/Structured paths can lower automation and correlation barriers\. This observation is not an allegation of illegality\./)).toBeVisible()
  await expect(page.getByText('The interaction design was informed by private family research; no family data or real electoral-roll record is included in this demo.')).toBeVisible()
  await expect(page.getByText('Only the synthetic Karnataka SIR profile works today.')).toBeVisible()
  expect(new URL(page.url())).toMatchObject({ pathname: '/', search: '', hash: '' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'About' })).toBeFocused()

  await page.getByRole('button', { name: 'Use example: Exact Kannada' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByRole('button', { name: 'Open larger view' })).toBeVisible()
  await page.getByRole('button', { name: 'Open larger view' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Synthetic source crop' })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Part KA-01')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open larger view' })).toBeFocused()
})

test('keeps 360px candidate details readable above the visible Next result action in English and Kannada evidence states', async ({ page }) => {
  const inspectCandidateLayout = async () => {
    await expect(page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('.candidate-card')
      const details = card?.querySelector<HTMLElement>(':scope > div')
      const next = card?.querySelector<HTMLElement>('.candidate-next')
      if (!card || !details || !next) return false
      const cardBox = card.getBoundingClientRect()
      const detailsBox = details.getBoundingClientRect()
      const nextBox = next.getBoundingClientRect()
      return detailsBox.width >= cardBox.width * 0.75
        && nextBox.top >= detailsBox.bottom
        && document.documentElement.scrollWidth <= window.innerWidth
    })).resolves.toBe(true)
  }

  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Use example: Exact Kannada' }).click()
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByText('Next result', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next result' })).toBeDisabled()
  await inspectCandidateLayout()

  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Switch to Kannada' }).click()
  await expect(page.getByText('ಮುಂದಿನ ಫಲಿತಾಂಶ', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ಮುಂದಿನ ಫಲಿತಾಂಶ' })).toBeDisabled()
  await inspectCandidateLayout()
  await page.getByRole('button', { name: 'ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ' }).click()
  await expect(page.getByAltText('ಕೃತಕ ಮೂಲದ ಭಾಗದ ಚಿತ್ರ')).toBeVisible()
  await inspectCandidateLayout()
})

test('orients multiple possible matches with bounded result navigation and keeps source text after an image error', async ({ page }) => {
  await page.unroute('**/api/search')
  await page.unroute('**/api/evidence/*')
  await page.route('**/api/search', (route) => route.fulfill({ json: { state: 'possible_match', candidates: [ananya, kavya, { ...ananya, synthetic_id: 'SYN-KA-D', name: 'Deepa Rao', latin_name: 'Deepa Rao', evidence_id: 'evidence-syn-ka-d' }] } }))
  await page.route('**/api/evidence/*', (route) => route.abort())
  await page.goto('/')
  await page.getByLabel('Name').fill('Ananya')
  await page.getByRole('button', { name: 'Find possible matches' }).click()
  await expect(page.getByText('Result 1 of 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous result' })).toBeDisabled()
  await expect(page.getByText('Next result', { exact: true })).toBeVisible()
  await expect(page.locator('.candidate-step [role="status"], .candidate-step [aria-live]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Next result' }).click()
  await expect(page.getByText('Result 2 of 3')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ಕಾವ್ಯಾ ನಾಯಕ್ / Kavya Nayak' })).toBeVisible()
  await page.getByRole('button', { name: 'Next result' }).click()
  await expect(page.getByText('Result 3 of 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next result' })).toBeDisabled()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByRole('alert')).toContainText('Source evidence could not be displayed')
  await expect(page.locator('.evidence-fields dd').first()).toHaveText('Deepa Rao / Deepa Rao')
  await expect(page.locator('.evidence-step').getByText('Part KA-01')).toBeVisible()
  await page.getByRole('button', { name: 'Switch to Kannada' }).click()
  await expect(page.getByText('ಮುಂದಿನ ಫಲಿತಾಂಶ', { exact: true })).toBeVisible()
})

test('keeps the About dialog within the 360px narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'About' }).click()
  await expect(page.getByRole('dialog', { name: 'About this demo' })).toBeVisible()
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})

test('icon links load successfully', async ({ page }) => {
  await page.goto('/')
  const hrefs = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href))

  expect(hrefs).toHaveLength(2)
  for (const href of hrefs) expect((await page.request.get(href)).ok()).toBe(true)
})
