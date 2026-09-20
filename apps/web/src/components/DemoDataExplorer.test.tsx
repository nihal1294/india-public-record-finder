import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DemoDataExplorer } from './DemoDataExplorer'
import { messages } from '../i18n'

function records(count = 120) {
  return Array.from({ length: count }, (_, index) => ({
    synthetic_id: `SYN-KA-${String(index + 1).padStart(3, '0')}`,
    name: `ಹೆಸರು ${index + 1}`,
    latin_name: `Name ${index + 1}`,
    relative_name: `ಸಂಬಂಧಿ ${index + 1}`,
    latin_relative_name: `Relative ${index + 1}`,
    relationship: 'parent',
    locality: `ಊರು ${index + 1}`,
    latin_locality: `Locality ${index + 1}`,
    age: 20 + (index % 50),
    evidence_id: `evidence-${index + 1}`,
    source_part: `KA-${String((index % 6) + 1).padStart(2, '0')}`,
    source_page: index + 1,
  }))
}

describe('DemoDataExplorer', () => {
  it('keeps the judge-only warning before the loading state', () => {
    render(<DemoDataExplorer copy={messages.en.demo} status="loading" records={[]} onUseSample={() => undefined} />)

    const warning = screen.getByText('Judge-only test bench. Every record is fictional. A production service containing real records must not offer browse-all access.')
    const loading = screen.getByText('Loading fictional records')
    expect(warning.compareDocumentPosition(loading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers a localized retry after a catalog loading error', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<DemoDataExplorer copy={messages.en.demo} status="error" records={[]} onUseSample={() => undefined} onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows exactly 20 manifest-ordered records on the first page', () => {
    render(<DemoDataExplorer copy={messages.en.demo} status="ready" records={records()} onUseSample={() => undefined} />)

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(21)
    expect(within(table).getByText('SYN-KA-001')).toBeTruthy()
    expect(within(table).getByText('SYN-KA-020')).toBeTruthy()
    expect(within(table).queryByText('SYN-KA-021')).toBeNull()
    expect(screen.getByText('Showing 1-20 of 120 records')).toBeTruthy()
    expect(screen.getByText('Page 1 of 6')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled).toBe(true)
    const warning = screen.getByText(messages.en.demo.warning)
    const firstRecord = within(table).getByText('SYN-KA-001')
    expect(warning.compareDocumentPosition(firstRecord) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the warning before records through error, empty, and later-page states', async () => {
    const user = userEvent.setup()
    const explorer = render(<DemoDataExplorer copy={messages.en.demo} status="error" records={[]} onUseSample={() => undefined} />)
    const warning = screen.getByText(messages.en.demo.warning)
    const error = screen.getByRole('alert')
    expect(warning.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    explorer.unmount()

    render(<DemoDataExplorer copy={messages.en.demo} status="ready" records={records()} onUseSample={() => undefined} />)
    const emptyWarning = screen.getByText(messages.en.demo.warning)
    await user.type(screen.getByLabelText('Filter fictional records'), 'not-present')
    const empty = screen.getByText('No fictional records match this filter.')
    expect(emptyWarning.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.clear(screen.getByLabelText('Filter fictional records'))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    const laterRecord = screen.getByText('SYN-KA-021')
    expect(emptyWarning.compareDocumentPosition(laterRecord) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    'SYN-KA-001', 'ಹೆಸರು 1', 'Name 1', 'ಸಂಬಂಧಿ 1', 'Relative 1', 'ಊರು 1', 'Locality 1', 'KA-01',
  ])('filters by required field value %s and resets to page one', async (filter) => {
    const user = userEvent.setup()
    render(<DemoDataExplorer copy={messages.en.demo} status="ready" records={records()} onUseSample={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 6')).toBeTruthy()
    await user.type(screen.getByLabelText('Filter fictional records'), filter.toUpperCase())

    expect(screen.getByText(/Page 1 of/)).toBeTruthy()
    expect(screen.getByText('SYN-KA-001')).toBeTruthy()
  })

  it('filters by a source page token that appears in no other approved field', async () => {
    const user = userEvent.setup()
    const pageOnlyRecord = {
      ...records(1)[0],
      synthetic_id: 'SYN-KA-UNIQUE',
      name: 'Native unrelated',
      latin_name: 'Latin unrelated',
      relative_name: 'Relative unrelated',
      latin_relative_name: 'Latin relative unrelated',
      locality: 'Locality unrelated',
      latin_locality: 'Latin locality unrelated',
      source_part: 'KA-UNIQUE',
      source_page: 987654,
    }
    render(<DemoDataExplorer copy={messages.en.demo} status="ready" records={[pageOnlyRecord]} onUseSample={() => undefined} />)

    await user.type(screen.getByLabelText('Filter fictional records'), '987654')
    expect(screen.getByRole('cell', { name: /^987654$/ })).toBeTruthy()
    expect(screen.getByRole('cell', { name: /^SYN-KA-UNIQUE$/ })).toBeTruthy()
  })

  it('retries from a local loading state after an error', async () => {
    const user = userEvent.setup()
    let rejectFirst!: (error: Error) => void
    let resolveSecond!: (items: ReturnType<typeof records>) => void
    const demoRecords = vi.fn()
      .mockImplementationOnce(() => new Promise<ReturnType<typeof records>>((_, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<ReturnType<typeof records>>((resolve) => { resolveSecond = resolve }))
    render(<DemoDataExplorer copy={messages.en.demo} api={{ demoRecords }} onUseSample={() => undefined} />)

    expect(screen.getByRole('status').textContent).toBe('Loading fictional records')
    await act(async () => rejectFirst(new Error('temporary')))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('status').textContent).toBe('Loading fictional records')
    expect(demoRecords).toHaveBeenCalledTimes(2)
    await act(async () => resolveSecond([records(1)[0]]))
    expect(await screen.findByRole('cell', { name: /^SYN-KA-001$/ })).toBeTruthy()
  })

  it('reaches all six pages in manifest order without duplicate or omitted IDs', async () => {
    const user = userEvent.setup()
    render(<DemoDataExplorer copy={messages.en.demo} status="ready" records={records()} onUseSample={() => undefined} />)
    const ids: string[] = []
    for (let page = 1; page <= 6; page += 1) {
      const bodyRows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
      ids.push(...bodyRows.map((row) => within(row).getAllByRole('cell')[0].textContent ?? ''))
      if (page < 6) await user.click(screen.getByRole('button', { name: 'Next page' }))
    }

    expect(ids).toEqual(records().map((record) => record.synthetic_id))
    expect(screen.getByText('Showing 101-120 of 120 records')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('uses Kannada labels while preserving visible record values and omitting internal fields', () => {
    const record = records(1)[0]
    render(<DemoDataExplorer copy={messages.kn.demo} status="ready" records={[record]} onUseSample={() => undefined} />)

    expect(screen.getByText('ತೀರ್ಪುಗಾರರ ಪರೀಕ್ಷೆಗೆ ಮಾತ್ರ. ಪ್ರತಿಯೊಂದು ದಾಖಲೆ ಕಾಲ್ಪನಿಕ. ನಿಜವಾದ ವ್ಯಕ್ತಿಗಳ ದಾಖಲೆಗಳನ್ನು ಒಳಗೊಂಡ ಉತ್ಪಾದನಾ ಸೇವೆಯಲ್ಲಿ ಎಲ್ಲ ದಾಖಲೆಗಳನ್ನು ಒಟ್ಟಾಗಿ ವೀಕ್ಷಿಸುವ ಅವಕಾಶ ಇರಬಾರದು.')).toBeTruthy()
    expect(screen.getByLabelText('ಕಾಲ್ಪನಿಕ ದಾಖಲೆಗಳನ್ನು ಶೋಧಿಸಿ')).toBeTruthy()
    expect(screen.getByText(record.name)).toBeTruthy()
    expect(screen.queryByText(record.evidence_id)).toBeNull()
    expect(screen.queryByText(record.relationship)).toBeNull()
  })
})
