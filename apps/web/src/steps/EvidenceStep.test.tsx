import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EvidenceStep } from './EvidenceStep'

const candidate = {
  synthetic_id: 'SYN-KA-A', name: 'ಅನನ್ಯಾ ಗೌಡ', latin_name: 'Ananya Gowda', relative_name: 'Ramesh Gowda', locality: 'Chennapura', age: 28, evidence_id: 'evidence-SYN-KA-A', source_part: 'KA-01', source_page: 1,
}

describe('EvidenceStep', () => {
  it('shows loading, failure, and the candidate fields alongside source evidence', () => {
    render(<EvidenceStep candidate={candidate} source="/api/evidence/evidence-SYN-KA-A" />)

    expect(screen.getByText('Loading source evidence…')).toBeTruthy()
    expect(screen.getByText(/Ananya Gowda/)).toBeTruthy()
    const image = screen.getByAltText('Synthetic source crop')
    fireEvent.error(image)

    expect(screen.getByText(/source evidence could not be displayed/i)).toBeTruthy()
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Part KA-01') === true)).toBeTruthy()
  })
})
