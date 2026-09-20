import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import App from '../App'
import type { ApiClient } from '../api'
import type { SearchRequest, SearchResponse } from '../contracts'

const candidate = {
  synthetic_id: 'SYN-KA-C',
  name: 'ಕಾವ್ಯಾ ನಾಯಕ್',
  latin_name: 'Kavya Nayak',
  relative_name: 'Sunil Nayak',
  locality: 'Beluru',
  age: 31,
  evidence_id: 'evidence-syn-ka-c',
}

describe('guided refinement', () => {
  it('returns to visible editable details without injecting refinement or searching again', async () => {
    const user = userEvent.setup()
    const search = vi.fn(async (_query: SearchRequest): Promise<SearchResponse> => ({ state: 'needs_more_detail', candidates: [candidate] }))
    const api: ApiClient = {
      examples: async () => [],
      demoRecords: async () => [],
      search,
      evidenceUrl: (id) => `/api/evidence/${id}`,
    }
    render(<App api={api} />)

    await user.type(screen.getByLabelText('Name'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    await screen.findByText('Needs more detail')
    await user.click(screen.getByRole('button', { name: 'Edit search' }))

    expect(search).toHaveBeenCalledTimes(1)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Kavya Nayak')
    expect((screen.getByLabelText("Relative's name (optional)") as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Locality (optional)') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Age in roll year (optional)') as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(screen.getByLabelText("Relative's name (optional)"))
    expect(screen.queryByRole('button', { name: 'Apply details' })).toBeNull()
  })

  it('focuses the first optional field that is still missing', async () => {
    const user = userEvent.setup()
    const api: ApiClient = {
      examples: async () => [],
      demoRecords: async () => [],
      search: async () => ({ state: 'needs_more_detail', candidates: [candidate] }),
      evidenceUrl: (id) => `/api/evidence/${id}`,
    }
    render(<App api={api} />)

    await user.type(screen.getByLabelText('Name'), 'Kavya Nayak')
    await user.click(screen.getByRole('button', { name: 'Add more details' }))
    await user.type(screen.getByLabelText("Relative's name (optional)"), 'Sunil Nayak')
    await user.click(screen.getByRole('button', { name: 'Find possible matches' }))
    await screen.findByText('Needs more detail')
    await user.click(screen.getByRole('button', { name: 'Edit search' }))

    expect(document.activeElement).toBe(screen.getByLabelText('Locality (optional)'))
  })
})
