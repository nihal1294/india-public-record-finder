import { useState } from 'react'

import type { SearchCandidate } from '../contracts'

export function EvidenceStep({ candidate, source }: { candidate: SearchCandidate; source: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const name = candidate.latin_name ? `${candidate.name} / ${candidate.latin_name}` : candidate.name
  return (
    <section className="evidence-step" aria-live="polite">
      <div className="evidence-heading"><h2 id="evidence-heading" tabIndex={-1}>Check the source before deciding</h2><p>Part {candidate.source_part ?? 'KA-01'} <span>·</span> Page {candidate.source_page ?? 1}</p></div>
      {status === 'loading' && <p className="evidence-status" role="status">Loading source evidence…</p>}
      {status !== 'error' && <img alt="Synthetic source crop" className="evidence-image" data-loading={status === 'loading' || undefined} src={source} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />}
      {status === 'error' && <p className="evidence-error" role="alert">Source evidence could not be displayed. Check the displayed fields and source reference before deciding.</p>}
      <dl className="evidence-fields"><div><dt>Name</dt><dd>{name}</dd></div>{candidate.relative_name && <div><dt>Relative&apos;s name</dt><dd>{candidate.relative_name}</dd></div>}{candidate.locality && <div><dt>Locality</dt><dd>{candidate.locality}</dd></div>}{candidate.age !== undefined && <div><dt>Age in roll year</dt><dd>{candidate.age}</dd></div>}</dl>
      <p className="determination">Possible match — not an official determination.</p>
      <details className="how-search-worked"><summary><span>How search worked</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg></summary><p>Local aliases and local retrieval found possible matches. Check the source before deciding.</p></details>
    </section>
  )
}
