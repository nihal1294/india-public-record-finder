import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { messages } from '../i18n'
import { AboutDialog } from './AboutDialog'

describe('AboutDialog', () => {
  it('contains the six bounded trust sections and the official context link', () => {
    render(<AboutDialog copy={messages.en.about} closeLabel={messages.en.evidence.close} onClose={() => undefined} />)

    for (const heading of ['Why this exists', 'The privacy tradeoff', 'What this prototype does', 'What this demo contains', 'How it was informed', 'Where this can go']) {
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    }
    expect(screen.getByText(/120 fictional Karnataka records/i)).toBeTruthy()
    expect(screen.getByText('Karnataka CEO archival roll PDFs use structured paths identifying district, assembly constituency, and part. Structured paths can lower automation and correlation barriers. This observation is not an allegation of illegality. This independent prototype explores a purpose-limited alternative without reproducing a browse-all real-person directory.')).toBeTruthy()
    expect(screen.getByText('The interaction design was informed by private family research; no family data or real electoral-roll record is included in this demo.')).toBeTruthy()
    expect(screen.getByText('Public-source navigation')).toBeTruthy()
    expect(screen.getByText('Citizen-authorized and authority-managed retrieval')).toBeTruthy()
    expect(screen.getByText(/Personal or restricted records stay within the responsible authority/i)).toBeTruthy()
    expect(screen.getByText(/mixed public-metadata and authority-managed land\/property workflows/i)).toBeTruthy()
    expect(screen.getByText(/reference-led court case and order navigation with safeguards/i)).toBeTruthy()
    expect(screen.getByText(/without reproducing a browse-all real-person directory/i)).toBeTruthy()
    const official = screen.getByRole('link', { name: 'Karnataka CEO website (context only)' })
    expect(official.getAttribute('href')).toBe('https://ceo.karnataka.gov.in/')
    expect(official.getAttribute('target')).toBe('_blank')
    expect(official.getAttribute('rel')).toContain('noopener')
  })

  it('keeps the corrected authority-managed future boundary in Kannada', () => {
    render(<AboutDialog copy={messages.kn.about} closeLabel={messages.kn.evidence.close} onClose={() => undefined} />)

    expect(screen.getByText('ನಾಗರಿಕರ ಅನುಮತಿ ಮತ್ತು ಅಧಿಕಾರಿಯ ನಿರ್ವಹಣೆಯ ದಾಖಲೆ ಪಡೆಯುವಿಕೆ')).toBeTruthy()
    expect(screen.getByText(/ಕ್ರಮಬದ್ಧ ಮಾರ್ಗಗಳು ಸ್ವಯಂಚಾಲನೆ ಮತ್ತು ಸಂಬಂಧ ಜೋಡಣೆಯ ಅಡೆತಡೆಗಳನ್ನು ಕಡಿಮೆ ಮಾಡಬಹುದು/)).toBeTruthy()
    expect(screen.getByText('ಈ ಸಂವಹನ ವಿನ್ಯಾಸವು ಖಾಸಗಿ ಕುಟುಂಬ ಸಂಶೋಧನೆಯಿಂದ ರೂಪುಗೊಂಡಿದೆ; ಈ ಡೆಮೊದಲ್ಲಿ ಕುಟುಂಬದ ಮಾಹಿತಿ ಅಥವಾ ನಿಜವಾದ ಮತದಾರರ ಪಟ್ಟಿಯ ದಾಖಲೆ ಇಲ್ಲ.')).toBeTruthy()
    expect(screen.getByText(/ವೈಯಕ್ತಿಕ ಅಥವಾ ನಿರ್ಬಂಧಿತ ದಾಖಲೆಗಳು/)).toBeTruthy()
    expect(screen.getByText(/ಭೂಮಿ\/ಆಸ್ತಿ ಕಾರ್ಯಪ್ರವಾಹಗಳು/)).toBeTruthy()
    expect(screen.getByText(/ನ್ಯಾಯಾಲಯದ ಪ್ರಕರಣ ಮತ್ತು ಆದೇಶ ಮಾರ್ಗದರ್ಶನ/)).toBeTruthy()
  })
})
