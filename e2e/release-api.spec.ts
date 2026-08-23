import { expect, test } from '@playwright/test'

test('runs all fictional examples through the read-only service', async ({ page, context }) => {
  const fontResponse = page.waitForResponse((response) => response.url().endsWith('/fonts/noto-sans-kannada/NotoSansKannada-Regular.ttf'))
  await page.goto('/')
  await expect((await fontResponse).status()).toBe(200)
  await expect(page.evaluate(async () => {
    await document.fonts.ready
    return document.fonts.check('16px "Noto Sans Kannada"')
  })).resolves.toBe(true)
  await page.getByRole('button', { name: 'Exact Kannada' }).click()
  await expect(page.getByRole('heading', { name: 'ಅನನ್ಯಾ ಗೌಡ / Ananya Gowda' })).toBeVisible()
  await expect(page.getByText('1 possible match')).toBeVisible()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByAltText('Synthetic source crop')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Romanized typo' }).click()
  await expect(page.getByRole('heading', { name: 'ಅನನ್ಯಾ ಗೌಡ / Ananya Gowda' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Needs refinement' }).click()
  await expect(page.getByText('Needs more detail')).toBeVisible()
  await page.getByRole('button', { name: 'Apply details' }).click()
  await expect(page.getByRole('heading', { name: 'ಕಾವ್ಯ ನಾಯಕ್ / Kavya Nayak' })).toBeVisible()
  await page.getByRole('button', { name: 'Verify source' }).click()
  await expect(page.getByAltText('Synthetic source crop')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'No confident match' }).click()
  await expect(page.getByText('We could not find a confident result.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Verify source' })).toHaveCount(0)
  await expect(page).toHaveURL('http://127.0.0.1:8766/')
  await expect(page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).resolves.toEqual({ local: 0, session: 0 })
  await expect(context.cookies()).resolves.toEqual([])
})
