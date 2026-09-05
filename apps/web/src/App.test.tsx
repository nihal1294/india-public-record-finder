import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import type { ApiClient } from './api'
import type { DemoExample, DemoRecord, SearchCandidate, SearchResponse } from './contracts'

const candidate: SearchCandidate = {
  synthetic_id: 'SYN-KA-C',
  name: 'ಕಾವ್ಯಾ ನಾಯಕ್',
  latin_name: 'Kavya Nayak',
  relative_name: 'Sunil Nayak',
  locality: 'Beluru',
  age: 31,
  evidence_id: 'evidence-SYN-KA-C',
  source_part: 'KA-01',
  source_page: 1,
  match_reasons: [
    { field: 'Name', value: 'Kavya Nayak', match: 'Exact match' },
  ],
}

const fakeApi: ApiClient = {
  examples: async () => [],
  demoRecords: async () => [],
  search: async () => ({ state: 'no_confident_result', candidates: [] }),
  evidenceUrl: (id) => `/api/evidence/${id}`,
}

const nonCuratedRecord: DemoRecord = {
  synthetic_id: 'SYN-KA-012',
  name: 'ಗೀತಾ ದೇವಿ',
  latin_name: 'Geetha Devi',
  relative_name: 'ರಾಜು ದೇವಿ',
  latin_relative_name: 'Raju Devi',
  relationship: 'parent',
  locality: 'ಮಲ್ಲೇಶ್ವರ',
  latin_locality: 'Malleshwara',
  age: 43,
  evidence_id: 'evidence-SYN-KA-012',
  source_part: 'KA-03',
  source_page: 12,
}

let initialDocumentLanguage = ''

beforeEach(() => {
  initialDocumentLanguage = document.documentElement.lang
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  document.cookie = 'language-state-boundary=; Max-Age=0; path=/'
  document.cookie = 'about-boundary=; Max-Age=0; path=/'
  document.documentElement.lang = initialDocumentLanguage
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

describe('App', () => {
  it('tracks the three citizen actions and returns to person details on reset', async () => {
    const user = userEvent.setup()
    const search = vi.fn(async () => ({ state: 'possible_match' as const, candidates: [candidate] }))
    render(<App api={{ ...fakeApi, search }} />)
    const progress = within(screen.getByRole('navigation', { name: 'Search progress' }))

    expect(progress.getAllByRole('listitem')).toHaveLength(3)
    expect(progress.getByRole('listitem', { name: 'Person details' }).getAttribute('aria-current')).toBe('step')
    await user.type(screen.getByLabelText('Name'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    expect(progress.getByRole('listitem', { name: 'Possible matches' }).getAttribute('aria-current')).toBe('step')
    await user.click(screen.getByRole('button', { name: 'Verify source' }))
    expect(progress.getByRole('listitem', { name: 'Verify source' }).getAttribute('aria-current')).toBe('step')
    expect(screen.getByRole('heading', { name: 'Check the source before deciding' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(progress.getByRole('listitem', { name: 'Person details' }).getAttribute('aria-current')).toBe('step')
    expect(screen.queryByRole('heading', { name: 'Check the source before deciding' })).toBeNull()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('')
  })

  it('opens About from the real header without changing the route, form, storage, or cookies', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/?keep=clean#context')
    document.cookie = 'about-boundary=present'
    const localStorageSet = vi.spyOn(Storage.prototype, 'setItem')
    const sessionStorageSet = vi.spyOn(Storage.prototype, 'setItem')
    render(<App api={fakeApi} />)

    await user.type(screen.getByLabelText('Name'), 'Kavya Nayak')
    const canonicalLocation = window.location.href
    await user.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByRole('dialog', { name: 'About this demo' })).toBeTruthy()
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
    expect(window.location.href).toBe(canonicalLocation)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Kavya Nayak')
    expect(localStorageSet).not.toHaveBeenCalled()
    expect(sessionStorageSet).not.toHaveBeenCalled()
    expect(document.cookie).toBe('about-boundary=present')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps a no-result query editable without another API action until explicit resubmission', async () => {
    const user = userEvent.setup()
    const search = vi.fn(async () => ({ state: 'no_confident_result' as const, candidates: [] }))
    render(<App api={{ ...fakeApi, search }} />)

    await user.type(screen.getByLabelText('Name'), 'Nandini Meridian')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    expect(await screen.findByText('We could not find a confident result.')).toBeTruthy()
    expect(screen.getByText('Your entries were not saved.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Edit search' }))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Nandini Meridian')
    expect(search).toHaveBeenCalledTimes(1)
    await user.type(screen.getByLabelText('Name'), 'a')
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('loads the direct demo route once and hands a non-curated visible sample to search without auto-submitting', async () => {
    const user = userEvent.setup()
    const demoRecords = vi.fn(async () => [nonCuratedRecord])
    const search = vi.fn(fakeApi.search)
    window.history.replaceState({}, '', '/demo-data')
    render(<App api={{ ...fakeApi, demoRecords, search }} />)

    expect(await screen.findByText('SYN-KA-012')).toBeTruthy()
    expect(demoRecords).toHaveBeenCalledTimes(1)
    expect(search).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Use this sample: SYN-KA-012' }))

    expect(window.location.pathname).toBe('/')
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('ಗೀತಾ ದೇವಿ')
    expect((screen.getByLabelText("Relative's name (optional)") as HTMLInputElement).value).toBe('ರಾಜು ದೇವಿ')
    expect((screen.getByLabelText('Locality (optional)') as HTMLInputElement).value).toBe('ಮಲ್ಲೇಶ್ವರ')
    expect((screen.getByLabelText('Age in roll year (optional)') as HTMLInputElement).value).toBe('43')
    expect(screen.getByRole('button', { name: 'Find possible matches' })).toBe(document.activeElement)
    expect(search).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    expect(search).toHaveBeenCalledWith({ name: 'ಗೀತಾ ದೇವಿ', relative_name: 'ರಾಜು ದೇವಿ', locality: 'ಮಲ್ಲೇಶ್ವರ', age: 43 })
  })

  it('only fetches the catalog on its route and ignores a stale completion after leaving', async () => {
    const user = userEvent.setup()
    let resolveFirst!: (records: DemoRecord[]) => void
    let resolveSecond!: (records: DemoRecord[]) => void
    const demoRecords = vi.fn()
      .mockImplementationOnce(() => new Promise<DemoRecord[]>((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise<DemoRecord[]>((resolve) => { resolveSecond = resolve }))
    window.history.replaceState({}, '', '/')
    render(<App api={{ ...fakeApi, demoRecords }} />)

    expect(demoRecords).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Browse fictional demo data' }))
    expect(demoRecords).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'India Public Record Finder' }))
    await user.click(screen.getByRole('button', { name: 'Browse fictional demo data' }))
    expect(demoRecords).toHaveBeenCalledTimes(2)
    await act(async () => resolveFirst([nonCuratedRecord]))
    expect(screen.queryByText('SYN-KA-012')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Loading fictional records')
    await act(async () => resolveSecond([{ ...nonCuratedRecord, synthetic_id: 'SYN-KA-013' }]))
    expect(await screen.findByText('SYN-KA-013')).toBeTruthy()
  })

  it('shows loading instead of ready rows when browser history re-enters the explorer', async () => {
    const user = userEvent.setup()
    let resolveSecond!: (records: DemoRecord[]) => void
    const demoRecords = vi.fn()
      .mockResolvedValueOnce([nonCuratedRecord])
      .mockImplementationOnce(() => new Promise<DemoRecord[]>((resolve) => { resolveSecond = resolve }))
    window.history.replaceState({}, '', '/')
    render(<App api={{ ...fakeApi, demoRecords }} />)

    await user.click(screen.getByRole('button', { name: 'Browse fictional demo data' }))
    expect(await screen.findByText('SYN-KA-012')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'India Public Record Finder' }))
    await act(async () => {
      window.history.pushState({}, '', '/demo-data')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(screen.getByRole('status').textContent).toBe('Loading fictional records')
    expect(screen.queryByText('SYN-KA-012')).toBeNull()
    await act(async () => resolveSecond([{ ...nonCuratedRecord, synthetic_id: 'SYN-KA-013' }]))
    expect(await screen.findByText('SYN-KA-013')).toBeTruthy()
  })

  it('retries a failed explorer request without retaining the prior catalog state', async () => {
    const user = userEvent.setup()
    let resolveRetry!: (records: DemoRecord[]) => void
    const demoRecords = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockImplementationOnce(() => new Promise<DemoRecord[]>((resolve) => { resolveRetry = resolve }))
    window.history.replaceState({}, '', '/demo-data')
    render(<App api={{ ...fakeApi, demoRecords }} />)

    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('status').textContent).toBe('Loading fictional records')
    expect(screen.queryByText('SYN-KA-012')).toBeNull()
    expect(demoRecords).toHaveBeenCalledTimes(2)
    await act(async () => resolveRetry([nonCuratedRecord]))
    expect(await screen.findByText('SYN-KA-012')).toBeTruthy()
  })

  it('starts with only Name and exposes explained optional fields on request', async () => {
    const user = userEvent.setup()
    render(<App api={fakeApi} />)

    expect(screen.getByLabelText('Name')).toBeTruthy()
    expect(screen.getByText('Kannada or English letters are accepted.')).toBeTruthy()
    expect(screen.queryByLabelText("Relative's name (optional)")).toBeNull()
    expect(screen.queryByLabelText('Locality (optional)')).toBeNull()
    expect(screen.queryByLabelText('Age in roll year (optional)')).toBeNull()

    const disclosure = screen.getByRole('button', { name: 'Add more details' })
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    await user.click(disclosure)

    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByLabelText("Relative's name (optional)")).toBeTruthy()
    expect(screen.getByText('Parent, spouse, guardian, or another relative as shown in the roll')).toBeTruthy()
    expect(screen.getByText('Village, ward, or neighbourhood')).toBeTruthy()
    expect(screen.getByText('Enter an estimate if the exact age is unknown.')).toBeTruthy()
  })

  it.each([
    ['Exact Kannada', 'ಅನನ್ಯಾ ಗೌಡ', true],
    ['Romanized spelling variation', 'Ananya Gowdaa', true],
    ['Needs refinement', 'Kavya Nayak', false],
    ['No confident match', 'Nandini Meridian', true],
  ])('prefills %s without searching and focuses submit', async (scenario, name, opensDetails) => {
    const user = userEvent.setup()
    const search = vi.fn(fakeApi.search)
    render(<App api={{ ...fakeApi, search }} />)

    await user.click(screen.getByRole('button', { name: `Use example: ${scenario}` }))

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(name)
    expect(search).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Find possible matches' })).toBe(document.activeElement)
    expect(screen.queryByLabelText("Relative's name (optional)") !== null).toBe(opensDetails)
  })

  it('submits exactly the visible prefilled query after a scenario is chosen', async () => {
    const user = userEvent.setup()
    const search = vi.fn(async () => ({ state: 'no_confident_result' as const, candidates: [] }))
    render(<App api={{ ...fakeApi, search }} />)

    await user.click(screen.getByRole('button', { name: 'Use example: Exact Kannada' }))
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))

    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith({ name: 'ಅನನ್ಯಾ ಗೌಡ', relative_name: 'ರಮೇಶ್ ಗೌಡ', locality: 'ಚೆನ್ನಾಪುರ', age: 28 })
  })

  it('shows bilingual-safe blank guidance until a search response replaces it', async () => {
    const user = userEvent.setup()
    render(<App api={fakeApi} />)

    expect(screen.getByRole('heading', { name: 'How this demo works' })).toBeTruthy()
    expect(screen.getByText('Enter a name in Kannada or English.')).toBeTruthy()
    expect(screen.getByText('This demo does not save entries or send your search to an LLM provider.')).toBeTruthy()
    expect(screen.getByText('Demo only. Every record is fictional. Do not enter real personal information. Entries are not saved.')).toBeTruthy()

    await user.type(screen.getByLabelText('Name'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))

    expect(await screen.findByRole('heading', { name: 'Possible matches' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'How this demo works' })).toBeNull()
  })

  it('restores the prior document language after unmount and begins a new mount in English', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/')
    document.documentElement.lang = 'fr'
    const firstApp = render(<App api={fakeApi} />)

    expect(document.documentElement.lang).toBe('en')
    await user.click(screen.getByRole('button', { name: 'Switch to Kannada' }))
    expect(document.documentElement.lang).toBe('kn')

    firstApp.unmount()
    expect(document.documentElement.lang).toBe('fr')

    const secondApp = render(<App api={fakeApi} />)
    expect(document.documentElement.lang).toBe('en')
    expect(screen.getByRole('heading', { name: 'Find a record. Verify the source.' })).toBeTruthy()
    secondApp.unmount()
    expect(document.documentElement.lang).toBe('fr')
  })

  it('switches owned search copy without persisting language and keeps it after route navigation', async () => {
    const user = userEvent.setup()
    const localStorageSet = vi.spyOn(Storage.prototype, 'setItem')
    const sessionStorageSet = vi.spyOn(Storage.prototype, 'setItem')
    window.history.replaceState({}, '', '/')
    document.cookie = 'language-state-boundary=before'
    render(<App api={fakeApi} />)

    expect(document.documentElement.lang).toBe('en')
    await user.click(screen.getByRole('button', { name: 'Switch to Kannada' }))

    expect(screen.getByRole('heading', { name: 'ದಾಖಲೆ ಹುಡುಕಿ. ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'ಇಂಗ್ಲಿಷ್‌ಗೆ ಬದಲಿಸಿ' })).toBeTruthy()
    expect(screen.getByText('ಡೆಮೊ ಮಾತ್ರ. ಎಲ್ಲ ದಾಖಲೆಗಳೂ ಕಾಲ್ಪನಿಕ. ನಿಜವಾದ ವೈಯಕ್ತಿಕ ಮಾಹಿತಿಯನ್ನು ನಮೂದಿಸಬೇಡಿ. ನಿಮ್ಮ ನಮೂದುಗಳನ್ನು ಉಳಿಸಲಾಗುವುದಿಲ್ಲ.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'ಈ ಡೆಮೊ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ' })).toBeTruthy()
    expect(screen.getByLabelText('ಹೆಸರು')).toBeTruthy()
    expect(screen.getByText('ಕನ್ನಡ ಅಥವಾ ಇಂಗ್ಲಿಷ್ ಅಕ್ಷರಗಳನ್ನು ಬಳಸಬಹುದು.')).toBeTruthy()
    expect(document.documentElement.lang).toBe('kn')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
    expect(localStorageSet).not.toHaveBeenCalled()
    expect(sessionStorageSet).not.toHaveBeenCalled()
    expect(document.cookie).toBe('language-state-boundary=before')

    await user.click(screen.getByRole('button', { name: 'ಕಾಲ್ಪನಿಕ ಡೆಮೊ ಮಾಹಿತಿಯನ್ನು ವೀಕ್ಷಿಸಿ' }))
    expect(screen.getByRole('heading', { name: 'ಕೃತಕ ಡೆಮೊ ದಾಖಲೆಗಳು' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('kn')
  })

  it('localizes the Kannada search summary, reset control, and result-region name without translating data', async () => {
    const user = userEvent.setup()
    const api: ApiClient = { ...fakeApi, search: async () => ({ state: 'possible_match', candidates: [candidate] }) }
    window.history.replaceState({}, '', '/')
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: 'Switch to Kannada' }))
    await user.type(screen.getByLabelText('ಹೆಸರು'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'ಹೆಚ್ಚಿನ ವಿವರಗಳನ್ನು ಸೇರಿಸಿ' }))
    await user.type(screen.getByLabelText('ಸಂಬಂಧಿಯ ಹೆಸರು (ಐಚ್ಛಿಕ)'), 'Sunil Nayak')
    await user.type(screen.getByLabelText('ಊರು, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ (ಐಚ್ಛಿಕ)'), 'Beluru')
    await user.type(screen.getByLabelText('ಮತದಾರರ ಪಟ್ಟಿಯ ವರ್ಷದ ವಯಸ್ಸು (ಐಚ್ಛಿಕ)'), '31')
    await user.click(screen.getByRole('button', { name: 'ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ಹುಡುಕಿ' }))

    const summary = await screen.findByRole('region', { name: 'ನಿಮ್ಮ ಹುಡುಕಾಟ' })
    expect(within(summary).getByRole('heading', { name: 'ನಿಮ್ಮ ಹುಡುಕಾಟ' })).toBeTruthy()
    expect(within(summary).getByText('ಹೆಸರು: “Kavya Nayak”')).toBeTruthy()
    expect(within(summary).getByText('ಸಂಬಂಧಿ: “Sunil Nayak”')).toBeTruthy()
    expect(within(summary).getByText('ಊರು, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ: “Beluru”')).toBeTruthy()
    expect(within(summary).getByText('ವಯಸ್ಸು: 31')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'ಹುಡುಕಾಟದ ಫಲಿತಾಂಶಗಳು' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'ಮರುಹೊಂದಿಸಿ' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'ಕಾವ್ಯಾ ನಾಯಕ್ / Kavya Nayak' })).toBeTruthy()
  })

  it('localizes a rejected Kannada search and clears its alert when a fictional example is chosen', async () => {
    const user = userEvent.setup()
    const search = vi.fn(async () => { throw new Error('unavailable') })
    window.history.replaceState({}, '', '/')
    render(<App api={{ ...fakeApi, search }} />)

    await user.click(screen.getByRole('button', { name: 'Switch to Kannada' }))
    await user.type(screen.getByLabelText('ಹೆಸರು'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ಹುಡುಕಿ' }))

    expect((await screen.findByRole('alert')).textContent).toBe('ಹುಡುಕಾಟ ಈಗ ಲಭ್ಯವಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ. ನಿಮ್ಮ ನಮೂದುಗಳನ್ನು ಉಳಿಸಲಾಗಿಲ್ಲ.')
    await user.click(screen.getByRole('button', { name: 'ಈ ಉದಾಹರಣೆಯನ್ನು ಬಳಸಿ: ಕನ್ನಡದಲ್ಲಿ ನಿಖರ ಹೊಂದಾಣಿಕೆ' }))

    expect(search).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears a service-error alert when the citizen edits the query', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/')
    render(<App api={{ ...fakeApi, search: async () => { throw new Error('unavailable') } }} />)

    await user.type(screen.getByLabelText('Name'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    await screen.findByRole('alert')
    await user.type(screen.getByLabelText('Name'), 'a')

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('uses the active language for an already visible service-error alert', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/')
    render(<App api={{ ...fakeApi, search: async () => { throw new Error('unavailable') } }} />)

    await user.type(screen.getByLabelText('Name'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Search is unavailable. Try again. Your entries were not saved.')
    await user.click(screen.getByRole('button', { name: 'Switch to Kannada' }))

    expect(screen.getByRole('alert').textContent).toBe('ಹುಡುಕಾಟ ಈಗ ಲಭ್ಯವಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ. ನಿಮ್ಮ ನಮೂದುಗಳನ್ನು ಉಳಿಸಲಾಗಿಲ್ಲ.')
  })

  it('switches owned copy on a directly loaded demo-data route without changing its clean URL', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/demo-data')
    render(<App api={fakeApi} />)

    await user.click(screen.getByRole('button', { name: 'Switch to Kannada' }))

    expect(screen.getByRole('heading', { name: 'ಕೃತಕ ಡೆಮೊ ದಾಖಲೆಗಳು' })).toBeTruthy()
    expect(screen.getByText('ತೀರ್ಪುಗಾರರ ಪರೀಕ್ಷೆಗೆ ಮಾತ್ರ. ಪ್ರತಿಯೊಂದು ದಾಖಲೆ ಕಾಲ್ಪನಿಕ. ನಿಜವಾದ ವ್ಯಕ್ತಿಗಳ ದಾಖಲೆಗಳನ್ನು ಒಳಗೊಂಡ ಉತ್ಪಾದನಾ ಸೇವೆಯಲ್ಲಿ ಎಲ್ಲ ದಾಖಲೆಗಳನ್ನು ಒಟ್ಟಾಗಿ ವೀಕ್ಷಿಸುವ ಅವಕಾಶ ಇರಬಾರದು.')).toBeTruthy()
    expect(document.documentElement.lang).toBe('kn')
    expect(window.location.pathname).toBe('/demo-data')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
  })

  it('navigates to the synthetic demo route without a query or fragment', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/')
    render(<App api={fakeApi} />)

    await user.click(screen.getByRole('button', { name: 'Browse fictional demo data' }))

    expect(window.location.pathname).toBe('/demo-data')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
    expect(screen.getByRole('heading', { name: 'Synthetic demo records' })).toBeTruthy()
    expect(screen.getByText('Judge-only test bench. Every record is fictional. A production service containing real records must not offer browse-all access.')).toBeTruthy()
  })

  it.each(['/?legacy=true#top', '/#top', '/#prototype'])('canonicalizes %s without clearing a typed search query', async (staleUrl) => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', staleUrl)
    render(<App api={fakeApi} />)

    const name = screen.getByLabelText('Name') as HTMLInputElement
    await user.type(name, 'Ananya Gowdaa')
    await user.click(screen.getByRole('button', { name: 'India Public Record Finder' }))

    expect(name.value).toBe('Ananya Gowdaa')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
  })

  it('opens, closes, and activates the responsive header menu with the keyboard', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/')
    render(<App api={fakeApi} />)

    const menu = screen.getByRole('button', { name: 'Menu' })
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    await user.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Browse fictional demo data' }))
    await user.keyboard('{Escape}')
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(menu)

    await user.click(menu)
    await user.click(screen.getByRole('button', { name: 'Browse fictional demo data' }))
    expect(screen.getByRole('heading', { name: 'Synthetic demo records' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('ignores a search completion after leaving the search route', async () => {
    const user = userEvent.setup()
    let resolveSearch!: (response: SearchResponse) => void
    const search = () => new Promise<SearchResponse>((resolve) => { resolveSearch = resolve })
    window.history.replaceState({}, '', '/')
    render(<App api={{ ...fakeApi, search }} />)

    await user.type(screen.getByLabelText('Name'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    await user.click(screen.getByRole('button', { name: 'Browse fictional demo data' }))
    await act(async () => resolveSearch({ state: 'possible_match', candidates: [candidate] }))
    await user.click(screen.getByRole('button', { name: 'India Public Record Finder' }))

    expect(screen.queryByRole('heading', { name: 'Possible matches' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Your search' })).toBeNull()
  })

  it('keeps the prototype boundary copy and never persists a query', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/')
    const local = new Map<string, string>()
    const session = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { get length() { return local.size }, clear: () => local.clear() } })
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: { get length() { return session.size }, clear: () => session.clear() } })

    render(<App api={fakeApi} />)

    expect(screen.getByText('Find a record. Verify the source.')).toBeTruthy()
    await user.type(screen.getByLabelText('Name'), 'Ananya Gowdaa')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))

    expect(await screen.findByRole('heading', { name: 'Possible matches' })).toBe(document.activeElement)
    expect(window.location.search).toBe('')
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('retains the complete fallback when the API returns only a partial example set', async () => {
    const partial: DemoExample = {
      id: 'exact-kannada', label: 'Exact Kannada', query: { name: 'ಅನನ್ಯಾ ಗೌಡ' }, expected_state: 'possible_match', expected_record_id: 'SYN-KA-A',
    }
    const api: ApiClient = { ...fakeApi, examples: async () => [partial] }
    render(<App api={api} />)

    expect(await screen.findByRole('button', { name: 'Use example: Exact Kannada' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use example: Romanized spelling variation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use example: Needs refinement' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use example: No confident match' })).toBeTruthy()
  })

  it('announces the explicit limited-search state', async () => {
    const user = userEvent.setup()
    render(<App api={{ ...fakeApi, search: async () => ({ state: 'limited_search', candidates: [] }) }} />)

    await user.type(screen.getByLabelText('Name'), 'Ananya Gowdaa')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))

    expect(await screen.findByText(/search is temporarily limited/i)).toBeTruthy()
  })

  it('does not offer an automatic refinement for an ordinary search', async () => {
    const user = userEvent.setup()
    const api: ApiClient = {
      ...fakeApi,
      search: async () => ({ state: 'needs_more_detail', candidates: [candidate] }),
    }
    render(<App api={api} />)

    await user.type(screen.getByLabelText('Name'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))

    expect(await screen.findByText('Needs more detail')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Apply details' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit search' })).toBeTruthy()
  })

  it('keeps a chosen refinement scenario as a prefill until the person explicitly submits it', async () => {
    const user = userEvent.setup()
    const search = vi.fn(async () => ({ state: 'needs_more_detail' as const, candidates: [candidate] }))
    render(<App api={{ ...fakeApi, search }} />)

    await user.click(screen.getByRole('button', { name: 'Use example: Needs refinement' }))
    expect(search).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Different person')

    expect(search).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Apply details' })).toBeNull()
  })

  it('keeps the search summary tied to the submitted query while inputs are edited', async () => {
    const user = userEvent.setup()
    const api: ApiClient = {
      ...fakeApi,
      search: async () => ({ state: 'possible_match', candidates: [candidate] }),
    }
    render(<App api={api} />)

    const name = screen.getByLabelText('Name')
    await user.type(name, 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    const summary = await screen.findByRole('region', { name: 'Your search' })
    expect(within(summary).getByText('Name: “Kavya Nayak”')).toBeTruthy()

    await user.clear(name)
    await user.type(name, 'Different person')

    expect(within(summary).getByText('Name: “Kavya Nayak”')).toBeTruthy()
    expect(within(summary).queryByText('Name: “Different person”')).toBeNull()
  })

  it('removes stale results when a subsequent search fails', async () => {
    const user = userEvent.setup()
    const search = vi.fn()
      .mockResolvedValueOnce({ state: 'possible_match', candidates: [candidate] })
      .mockRejectedValueOnce(new Error('unavailable'))
    render(<App api={{ ...fakeApi, search }} />)

    const name = screen.getByLabelText('Name')
    await user.type(name, 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    expect(await screen.findByRole('heading', { name: /ಕಾವ್ಯಾ ನಾಯಕ್/ })).toBeTruthy()

    await user.clear(name)
    await user.type(name, 'Different person')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Search is unavailable. Try again. Your entries were not saved.')
    expect(screen.queryByRole('heading', { name: /ಕಾವ್ಯಾ ನಾಯಕ್/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Your search' })).toBeNull()
  })

  it('ignores an in-flight explicitly submitted example result after the form is edited', async () => {
    const user = userEvent.setup()
    let resolveSearch!: (response: { state: 'needs_more_detail'; candidates: SearchCandidate[] }) => void
    const search = () => new Promise<{ state: 'needs_more_detail'; candidates: SearchCandidate[] }>((resolve) => {
      resolveSearch = resolve
    })
    render(<App api={{ ...fakeApi, search }} />)

    await user.click(screen.getByRole('button', { name: 'Use example: Needs refinement' }))
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    const name = screen.getByLabelText('Name') as HTMLInputElement
    await user.clear(name)
    await user.type(name, 'Different person')
    await act(async () => resolveSearch({ state: 'needs_more_detail', candidates: [candidate] }))

    expect(name.value).toBe('Different person')
    expect(screen.queryByText('Needs more detail')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Apply details' })).toBeNull()
  })

  it('ignores an in-flight explicitly submitted example result after reset', async () => {
    const user = userEvent.setup()
    let resolveSearch!: (response: { state: 'needs_more_detail'; candidates: SearchCandidate[] }) => void
    const search = () => new Promise<{ state: 'needs_more_detail'; candidates: SearchCandidate[] }>((resolve) => {
      resolveSearch = resolve
    })
    render(<App api={{ ...fakeApi, search }} />)

    await user.click(screen.getByRole('button', { name: 'Use example: Needs refinement' }))
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await act(async () => resolveSearch({ state: 'needs_more_detail', candidates: [candidate] }))

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('')
    expect(screen.queryByText('Needs more detail')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Apply details' })).toBeNull()
  })
})
