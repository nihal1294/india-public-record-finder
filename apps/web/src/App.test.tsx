import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import App from './App'
import type { ApiClient } from './api'
import type { DemoExample, SearchCandidate } from './contracts'

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
  search: async () => ({ state: 'no_confident_result', candidates: [] }),
  evidenceUrl: (id) => `/api/evidence/${id}`,
}

describe('App', () => {
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

    expect(await screen.findByRole('button', { name: 'Exact Kannada' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Romanized typo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Needs refinement' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'No confident match' })).toBeTruthy()
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
  })

  it('invalidates a selected example refinement when the form is edited', async () => {
    const user = userEvent.setup()
    const api: ApiClient = {
      ...fakeApi,
      search: async () => ({ state: 'needs_more_detail', candidates: [candidate] }),
    }
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: 'Needs refinement' }))
    expect(await screen.findByText('Needs more detail')).toBeTruthy()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Different person')

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

    expect((await screen.findByRole('alert')).textContent).toBe('Search is unavailable. Try again.')
    expect(screen.queryByRole('heading', { name: /ಕಾವ್ಯಾ ನಾಯಕ್/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Your search' })).toBeNull()
  })

  it('ignores an in-flight example result after the form is edited', async () => {
    const user = userEvent.setup()
    let resolveSearch!: (response: { state: 'needs_more_detail'; candidates: SearchCandidate[] }) => void
    const search = () => new Promise<{ state: 'needs_more_detail'; candidates: SearchCandidate[] }>((resolve) => {
      resolveSearch = resolve
    })
    render(<App api={{ ...fakeApi, search }} />)

    await user.click(screen.getByRole('button', { name: 'Needs refinement' }))
    const name = screen.getByLabelText('Name') as HTMLInputElement
    await user.clear(name)
    await user.type(name, 'Different person')
    await act(async () => resolveSearch({ state: 'needs_more_detail', candidates: [candidate] }))

    expect(name.value).toBe('Different person')
    expect(screen.queryByText('Needs more detail')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Apply details' })).toBeNull()
  })

  it('ignores an in-flight example result after reset', async () => {
    const user = userEvent.setup()
    let resolveSearch!: (response: { state: 'needs_more_detail'; candidates: SearchCandidate[] }) => void
    const search = () => new Promise<{ state: 'needs_more_detail'; candidates: SearchCandidate[] }>((resolve) => {
      resolveSearch = resolve
    })
    render(<App api={{ ...fakeApi, search }} />)

    await user.click(screen.getByRole('button', { name: 'Needs refinement' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await act(async () => resolveSearch({ state: 'needs_more_detail', candidates: [candidate] }))

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('')
    expect(screen.queryByText('Needs more detail')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Apply details' })).toBeNull()
  })
})
