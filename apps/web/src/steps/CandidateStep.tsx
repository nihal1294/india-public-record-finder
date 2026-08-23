import type { SearchCandidate, SearchState } from '../contracts'

function Chevron({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return <svg aria-hidden="true" className={`chevron ${direction}`} viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg>
}

export function CandidateStep({
  state,
  candidates,
  index,
  onPrevious,
  onNext,
  onVerify,
  onApplyDetails,
}: {
  state: SearchState
  candidates: SearchCandidate[]
  index: number
  onPrevious: () => void
  onNext: () => void
  onVerify: () => void
  onApplyDetails?: () => void
}) {
  if (state === 'no_confident_result') {
    return <section className="result-empty" aria-live="polite"><h2 id="result-heading" tabIndex={-1}>Possible matches</h2><p>We could not find a confident result.</p><p>Try changing the name, locality, or relative&apos;s name.</p></section>
  }
  if (state === 'limited_search' && candidates.length === 0) {
    return <section className="result-empty" aria-live="polite"><h2 id="result-heading" tabIndex={-1}>Possible matches</h2><p className="limited-search">Search is temporarily limited. Results may be incomplete.</p></section>
  }
  const candidate = candidates[index]
  if (!candidate) return null
  const reasons = candidate.match_reasons?.length ? candidate.match_reasons : [
    { field: 'Name', value: candidate.latin_name ?? candidate.name, match: 'Close match' },
    ...(candidate.relative_name ? [{ field: "Relative's name", value: candidate.relative_name, match: 'Exact match' }] : []),
    ...(candidate.locality ? [{ field: 'Locality', value: candidate.locality, match: 'Exact match' }] : []),
  ]
  return (
    <section className="candidate-step" aria-live="polite">
      <h2 id="result-heading" tabIndex={-1}>Possible matches</h2>
      <p className="match-count">{candidates.length} possible {candidates.length === 1 ? 'match' : 'matches'}</p>
      {state === 'limited_search' && <p className="limited-search" role="status">Search is temporarily limited. Results may be incomplete.</p>}
      {state === 'needs_more_detail' && <div className="refinement" role="status"><p>Needs more detail</p></div>}
      <article className="candidate-card">
        <span className="match-dot" aria-hidden="true" />
        <div><h3>{candidate.name}{candidate.latin_name && <> <span>/</span> {candidate.latin_name}</>}</h3><p>{candidate.relative_name}</p><p>{candidate.locality}</p><p>Age in roll year: {candidate.age}</p></div>
        <button className="candidate-next" type="button" onClick={onNext} disabled={candidates.length < 2} aria-label="Next candidate"><Chevron /></button>
      </article>
      <h3 className="why-heading">Why this surfaced</h3>
      <ul className="reasons">{reasons.map((reason) => <li key={`${reason.field}-${reason.value}`}><span><b>{reason.field}:</b> “{reason.value}”</span><strong>{reason.match}</strong></li>)}</ul>
      <div className="candidate-actions">
        <button type="button" className="secondary-button" onClick={onPrevious} disabled={candidates.length < 2}><Chevron direction="left" />Previous</button>
        <button type="button" className="primary-button" onClick={state === 'needs_more_detail' ? onApplyDetails : onVerify}>{state === 'needs_more_detail' ? 'Apply details' : 'Verify source'}<Chevron /></button>
      </div>
    </section>
  )
}
