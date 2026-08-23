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

async function installMockApi(page: Page) {
  await page.route('**/api/examples', (route) => route.fulfill({ json: examples }))
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

test('runs all four fictional examples without persisting a query', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Exact Kannada' }).click()
  await expect(page.getByRole('heading', { name: 'ಅನನ್ಯಾ ಗೌಡ / Ananya Gowda' })).toBeVisible()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByAltText('Synthetic source crop')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Romanized typo' }).click()
  await expect(page.getByRole('heading', { name: 'Possible matches' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Needs refinement' }).click()
  await expect(page.getByText('Needs more detail')).toBeVisible()
  await page.getByRole('button', { name: 'Apply details' }).click()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByAltText('Synthetic source crop')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'No confident match' }).click()
  await expect(page.getByText('We could not find a confident result.')).toBeVisible()
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  await expect(page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).resolves.toEqual({ local: 0, session: 0 })
})

test('has no horizontal overflow at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})
