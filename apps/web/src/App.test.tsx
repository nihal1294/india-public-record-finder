import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'
import type { ApiClient } from './api'
import type { DemoExample } from './contracts'

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
})
