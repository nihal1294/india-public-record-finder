import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { messages } from '../i18n'
import { CandidateStep } from './CandidateStep'

const candidates = [
  { synthetic_id: 'SYN-KA-A', name: 'Ananya', relative_name: 'Ramesh', locality: 'Chennapura', age: 28, evidence_id: 'a', source_part: 'KA-01', source_page: 1, match_reasons: [{ field: 'Name', value: 'Ananya', match: 'Exact match' }] },
  { synthetic_id: 'SYN-KA-B', name: 'Bhavya', relative_name: 'Ravi', locality: 'Beluru', age: 30, evidence_id: 'b', source_part: 'KA-01', source_page: 2, match_reasons: [{ field: 'Unexpected signal', value: 'keep this', match: 'Unexpected match' }] },
  { synthetic_id: 'SYN-KA-C', name: 'Chitra', relative_name: 'Kiran', locality: 'Mysuru', age: 32, evidence_id: 'c', source_part: 'KA-02', source_page: 1 },
]

describe('CandidateStep', () => {
  it('orients result navigation without wrapping and localizes only known labels', async () => {
    const user = userEvent.setup()
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    const { container } = render(<CandidateStep state="possible_match" candidates={candidates} index={0} onPrevious={onPrevious} onNext={onNext} onVerify={vi.fn()} onEditSearch={vi.fn()} copy={messages.en.results} language="kn" />)

    expect(screen.getByText('Result 1 of 3')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Previous result' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Next result' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('Next result')).toBeTruthy()
    expect(screen.getByText('What matched your entry')).toBeTruthy()
    expect(screen.getByText('ನಿಖರ ಹೊಂದಾಣಿಕೆ')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Next result' }))
    expect(onNext).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('[aria-live], [role="status"]')).toHaveLength(1)
  })

  it('renders a visible Kannada Next result label', () => {
    render(<CandidateStep state="possible_match" candidates={candidates} index={1} onPrevious={vi.fn()} onNext={vi.fn()} onVerify={vi.fn()} onEditSearch={vi.fn()} copy={messages.kn.results} language="kn" />)

    expect(screen.getByText('ಮುಂದಿನ ಫಲಿತಾಂಶ')).toBeTruthy()
  })
})
