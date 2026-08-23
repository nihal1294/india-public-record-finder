import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import App from '../App'
import type { ApiClient } from '../api'
import type { DemoExample, SearchRequest, SearchResponse } from '../contracts'

const refinement: Partial<SearchRequest> = {
  relative_name: 'Sunil Nayak',
  locality: 'Beluru',
  age: 31,
}

const candidate = {
  synthetic_id: 'SYN-KA-C',
  name: 'ಕಾವ್ಯಾ ನಾಯಕ್',
  latin_name: 'Kavya Nayak',
  relative_name: 'Sunil Nayak',
  locality: 'Beluru',
  age: 31,
  evidence_id: 'evidence-syn-ka-c',
  source_part: 'KA-01',
  source_page: 1,
  match_reasons: [
    { field: 'Name', query: 'Kavya Nayak', value: 'Kavya Nayak', match: 'Exact match' },
  ],
}

const example: DemoExample = {
  id: 'needs-refinement',
  label: 'Needs refinement',
  query: { name: 'Kavya Nayak' },
  refinement,
  expected_state: 'needs_more_detail',
  expected_refined_state: 'possible_match',
  expected_record_id: 'SYN-KA-C',
}

const search = vi.fn(async (query: SearchRequest): Promise<SearchResponse> =>
  query.relative_name
    ? { state: 'possible_match', candidates: [candidate] }
    : { state: 'needs_more_detail', candidates: [candidate] },
)

const fakeExamplesApi: ApiClient = {
  examples: async () => [example],
  search,
  evidenceUrl: (id) => `/api/evidence/${id}`,
}

describe('guided refinement', () => {
  it('runs refinement before source verification', async () => {
    const user = userEvent.setup()
    search.mockClear()
    render(<App api={fakeExamplesApi} />)

    await user.click(await screen.findByRole('button', { name: 'Needs refinement' }))
    expect(await screen.findByText(/needs more detail/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /apply details/i }))
    expect(search).toHaveBeenLastCalledWith({ name: 'Kavya Nayak', relative_name: 'Sunil Nayak', locality: 'Beluru', age: 31 })
    await user.click(await screen.findByRole('button', { name: /verify source/i }))

    expect(await screen.findByAltText(/synthetic source crop/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Check the source before deciding' })).toBe(document.activeElement)
  })
})
