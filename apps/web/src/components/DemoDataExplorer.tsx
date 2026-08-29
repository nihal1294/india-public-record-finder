import { useEffect, useMemo, useRef, useState } from 'react'

import type { ApiClient } from '../api'
import type { DemoRecord } from '../contracts'
import { formatMessage, type Messages } from '../i18n'

const pageSize = 20

function matchesFilter(record: DemoRecord, filter: string): boolean {
  const query = filter.trim().toLocaleLowerCase()
  if (!query) return true
  return [
    record.synthetic_id,
    record.name,
    record.latin_name,
    record.relative_name,
    record.latin_relative_name,
    record.locality,
    record.latin_locality,
    record.source_part,
    String(record.source_page),
  ].some((value) => value.toLocaleLowerCase().includes(query))
}

interface ExplorerViewProps {
  copy: Messages['demo']
  status: 'loading' | 'error' | 'ready'
  records: DemoRecord[]
  onUseSample: (record: DemoRecord) => void
  onRetry?: () => void
}

interface ExplorerControllerProps {
  copy: Messages['demo']
  api: Pick<ApiClient, 'demoRecords'>
  onUseSample: (record: DemoRecord) => void
}

export function DemoDataExplorer(props: ExplorerViewProps | ExplorerControllerProps) {
  if ('api' in props) return <DemoDataExplorerController {...props} />
  return <DemoDataExplorerView {...props} />
}

function DemoDataExplorerController({ copy, api, onUseSample }: ExplorerControllerProps) {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [records, setRecords] = useState<DemoRecord[]>([])
  const [requestVersion, setRequestVersion] = useState(0)
  const generation = useRef(0)

  useEffect(() => {
    const requestGeneration = ++generation.current
    api.demoRecords().then((items) => {
      if (generation.current !== requestGeneration) return
      setRecords(items)
      setStatus('ready')
    }).catch(() => {
      if (generation.current === requestGeneration) setStatus('error')
    })
    return () => { generation.current += 1 }
  }, [api, requestVersion])

  const retry = () => {
    generation.current += 1
    setRecords([])
    setStatus('loading')
    setRequestVersion((current) => current + 1)
  }

  return <DemoDataExplorerView copy={copy} status={status} records={records} onUseSample={onUseSample} onRetry={retry} />
}

function DemoDataExplorerView({
  copy,
  status,
  records,
  onUseSample,
  onRetry,
}: ExplorerViewProps) {
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const filteredRecords = useMemo(() => records.filter((record) => matchesFilter(record, filter)), [filter, records])
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, filteredRecords.length)
  const visibleRecords = filteredRecords.slice(start - 1, end)
  const sampleHeader = formatMessage(copy.useSample, { id: '' }).replace(/:\s*$/, '')

  const updateFilter = (value: string) => {
    setFilter(value)
    setPage(1)
  }

  return (
    <main className="demo-data-view">
      <h1>{copy.heading}</h1>
      <p className="demo-warning">{copy.warning}</p>
      {status === 'loading' && <p role="status">{copy.loading}</p>}
      {status === 'error' && <><p role="alert">{copy.error}</p>{onRetry && <button type="button" className="secondary-button demo-retry-button" onClick={onRetry}>{copy.retry}</button>}</>}
      {status === 'ready' && <>
        <label className="demo-filter-label" htmlFor="demo-record-filter">{copy.filterLabel}</label>
        <p id="demo-record-filter-helper" className="field-helper">{copy.filterHelper}</p>
        <input id="demo-record-filter" aria-describedby="demo-record-filter-helper" value={filter} onChange={(event) => updateFilter(event.target.value)} />
        {filteredRecords.length === 0 ? <p role="status">{copy.noResults}</p> : <>
          <div className="demo-results-status" aria-live="polite">
            <p>{formatMessage(copy.showing, { start, end, total: filteredRecords.length })}</p>
            <p>{formatMessage(copy.page, { current: currentPage, total: pageCount })}</p>
          </div>
          <table className="demo-record-table" role="table">
            <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">{copy.syntheticId}</th><th role="columnheader" scope="col">{copy.nativeName}</th><th role="columnheader" scope="col">{copy.latinName}</th><th role="columnheader" scope="col">{copy.nativeRelativeName}</th><th role="columnheader" scope="col">{copy.latinRelativeName}</th><th role="columnheader" scope="col">{copy.nativeLocality}</th><th role="columnheader" scope="col">{copy.latinLocality}</th><th role="columnheader" scope="col">{copy.age}</th><th role="columnheader" scope="col">{copy.sourcePart}</th><th role="columnheader" scope="col">{copy.sourcePage}</th><th role="columnheader" scope="col"><span className="sr-only">{sampleHeader}</span></th></tr></thead>
            <tbody role="rowgroup">{visibleRecords.map((record) => <tr key={record.synthetic_id} role="row">
              <td role="cell" data-label={copy.syntheticId}>{record.synthetic_id}</td><td role="cell" data-label={copy.nativeName}>{record.name}</td><td role="cell" data-label={copy.latinName}>{record.latin_name}</td><td role="cell" data-label={copy.nativeRelativeName}>{record.relative_name}</td><td role="cell" data-label={copy.latinRelativeName}>{record.latin_relative_name}</td><td role="cell" data-label={copy.nativeLocality}>{record.locality}</td><td role="cell" data-label={copy.latinLocality}>{record.latin_locality}</td><td role="cell" data-label={copy.age}>{record.age}</td><td role="cell" data-label={copy.sourcePart}>{record.source_part}</td><td role="cell" data-label={copy.sourcePage}>{record.source_page}</td><td role="cell" data-label={copy.useSample}><button type="button" className="secondary-button demo-sample-button" onClick={() => onUseSample(record)}>{formatMessage(copy.useSample, { id: record.synthetic_id })}</button></td>
            </tr>)}</tbody>
          </table>
          <nav className="demo-pagination" aria-label={formatMessage(copy.page, { current: currentPage, total: pageCount })}>
            <button type="button" className="secondary-button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{copy.previousPage}</button>
            <button type="button" className="secondary-button" disabled={currentPage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>{copy.nextPage}</button>
          </nav>
        </>}
      </>}
    </main>
  )
}
