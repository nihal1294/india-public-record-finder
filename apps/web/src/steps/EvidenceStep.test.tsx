import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { messages } from '../i18n'
import { EvidenceStep } from './EvidenceStep'

const candidate = {
  synthetic_id: 'SYN-KA-A', name: 'ಅನನ್ಯಾ ಗೌಡ', latin_name: 'Ananya Gowda', relative_name: 'Ramesh Gowda', locality: 'Chennapura', age: 28, evidence_id: 'evidence-SYN-KA-A', source_part: 'KA-01', source_page: 1,
}

describe('EvidenceStep', () => {
  it.each([
    { source_part: undefined, source_page: undefined, reference: null },
    { source_part: 'KA-03', source_page: undefined, reference: 'Part KA-03' },
    { source_part: undefined, source_page: 7, reference: 'Page 7' },
  ])('shows only supplied source metadata: $reference', async ({ source_part, source_page, reference }) => {
    const user = userEvent.setup()
    render(<EvidenceStep candidate={{ ...candidate, source_part, source_page }} source="/api/evidence/evidence-SYN-KA-A" copy={messages.en.evidence} />)

    expect(screen.queryByText(/Part KA-01/)).toBeNull()
    expect(screen.queryByText(/Page 1/)).toBeNull()
    if (reference) expect(screen.getByText(reference)).toBeTruthy()
    fireEvent.load(screen.getByAltText('Synthetic source crop'))
    await user.click(screen.getByRole('button', { name: 'Open larger view' }))
    expect(screen.queryByText(/Part KA-01/)).toBeNull()
    expect(screen.queryByText(/Page 1/)).toBeNull()
    if (reference) expect(screen.getAllByText(reference)).toHaveLength(2)
  })

  it('shows loading, failure, and the candidate fields alongside source evidence', () => {
    render(<EvidenceStep candidate={candidate} source="/api/evidence/evidence-SYN-KA-A" copy={messages.en.evidence} />)

    expect(screen.getByText('Loading source evidence')).toBeTruthy()
    expect(screen.getByText(/Ananya Gowda/)).toBeTruthy()
    const image = screen.getByAltText('Synthetic source crop')
    fireEvent.error(image)

    expect(screen.getByText(/source evidence could not be displayed/i)).toBeTruthy()
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Part KA-01') === true)).toBeTruthy()
    expect(screen.getByText('Pre-indexed multilingual retrieval surfaced possible candidates. Check each displayed field and the source before deciding.')).toBeTruthy()
  })

  it('opens a larger accessible source view only after the crop loads', async () => {
    const user = userEvent.setup()
    render(<EvidenceStep candidate={candidate} source="/api/evidence/evidence-SYN-KA-A" copy={messages.en.evidence} />)

    const image = screen.getByAltText('Synthetic source crop')
    fireEvent.load(image)
    await user.click(screen.getByRole('button', { name: 'Open larger view' }))
    expect(screen.getByRole('dialog', { name: 'Synthetic source crop' })).toBeTruthy()
    expect(screen.getAllByAltText('Synthetic source crop')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open larger view' })).toBe(document.activeElement)
  })

  it('uses the bounded Kannada pre-indexed retrieval explanation', () => {
    render(<EvidenceStep candidate={candidate} source="/api/evidence/evidence-SYN-KA-A" copy={messages.kn.evidence} />)

    expect(screen.getByText('ಮೊದಲೇ ಸೂಚ್ಯಂಕಗೊಳಿಸಿದ ಬಹುಭಾಷಾ ಹುಡುಕಾಟವು ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ತೋರಿಸಿದೆ. ತೀರ್ಮಾನಕ್ಕೆ ಬರುವ ಮೊದಲು ತೋರಿಸಿರುವ ಪ್ರತಿಯೊಂದು ವಿವರ ಮತ್ತು ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.')).toBeTruthy()
  })
})
