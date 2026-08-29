import { useState } from 'react'

import { ModalDialog } from '../components/ModalDialog'
import type { SearchCandidate } from '../contracts'
import { formatMessage, type Messages } from '../i18n'

export function EvidenceStep({ candidate, source, copy }: { candidate: SearchCandidate; source: string; copy: Messages['evidence'] }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [showLarger, setShowLarger] = useState(false)
  const name = candidate.latin_name ? `${candidate.name} / ${candidate.latin_name}` : candidate.name
  const sourcePart = candidate.source_part ?? 'KA-01'
  const sourcePage = candidate.source_page ?? 1
  const sourceReference = <>{formatMessage(copy.part, { sourcePart })} <span>·</span> {formatMessage(copy.page, { sourcePage })}</>
  return (
    <section className="evidence-step" aria-live="polite">
      <div className="evidence-heading"><h2 id="evidence-heading" tabIndex={-1}>{copy.heading}</h2><p>{sourceReference}</p></div>
      {status === 'loading' && <p className="evidence-status" role="status">{copy.loading}</p>}
      {status !== 'error' && <img alt={copy.cropLabel} className="evidence-image" data-loading={status === 'loading' || undefined} src={source} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />}
      {status === 'loaded' && <button type="button" className="secondary-button evidence-enlarge" onClick={() => setShowLarger(true)}>{copy.openLarger}</button>}
      {status === 'error' && <p className="evidence-error" role="alert">{copy.error}</p>}
      <dl className="evidence-fields"><div><dt>{copy.name}</dt><dd>{name}</dd></div>{candidate.relative_name && <div><dt>{copy.relativeName}</dt><dd>{candidate.relative_name}</dd></div>}{candidate.locality && <div><dt>{copy.locality}</dt><dd>{candidate.locality}</dd></div>}{candidate.age !== undefined && <div><dt>{copy.ageInRollYear}</dt><dd>{candidate.age}</dd></div>}</dl>
      <p className="determination">{copy.caution}</p>
      <details className="how-search-worked"><summary><span>{copy.howSearchWorked}</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg></summary><p>{copy.howSearchDetail}</p></details>
      {showLarger && <ModalDialog title={copy.cropLabel} closeLabel={copy.close} onClose={() => setShowLarger(false)}><p className="modal-source-reference">{sourceReference}</p><img alt={copy.cropLabel} className="evidence-image evidence-image-large" src={source} /></ModalDialog>}
    </section>
  )
}
