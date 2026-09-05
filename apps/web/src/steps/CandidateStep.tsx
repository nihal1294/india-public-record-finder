import type { SearchCandidate, SearchState } from '../contracts'
import { displayMatchLabel, formatMessage, type Language, type Messages } from '../i18n'

function displayFieldLabel(value: string, copy: Messages['results']): string {
  const knownLabels: Record<string, string> = {
    Name: copy.fieldName,
    "Relative's name": copy.fieldRelativeName,
    Locality: copy.fieldLocality,
    Age: copy.fieldAge,
  }
  return knownLabels[value] ?? value
}

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
  onEditSearch,
  copy,
  language,
}: {
  state: SearchState
  candidates: SearchCandidate[]
  index: number
  onPrevious: () => void
  onNext: () => void
  onVerify: () => void
  onEditSearch: () => void
  copy: Messages['results']
  language: Language
}) {
  if (state === 'no_confident_result') {
    return <section className="result-empty" aria-live="polite"><h2 id="result-heading" tabIndex={-1}>{copy.heading}</h2><p>{copy.noConfidentResult}</p><p>{copy.changeSearch}</p><p>{copy.noSave}</p><button type="button" className="secondary-button" onClick={onEditSearch}>{copy.editSearch}</button></section>
  }
  if (state === 'limited_search' && candidates.length === 0) {
    return <section className="result-empty" aria-live="polite"><h2 id="result-heading" tabIndex={-1}>{copy.heading}</h2><p className="limited-search">{copy.limitedSearch}</p><p>{copy.noSave}</p><button type="button" className="secondary-button" onClick={onEditSearch}>{copy.editSearch}</button></section>
  }
  const candidate = candidates[index]
  if (!candidate) return null
  const reasons = candidate.match_reasons ?? []
  return (
    <section className="candidate-step">
      <h2 id="result-heading" tabIndex={-1}>{copy.heading}</h2>
      <p className="match-count">{formatMessage(candidates.length === 1 ? copy.oneMatch : copy.manyMatches, { count: candidates.length })}</p>
      <p className="candidate-caution">{copy.caution}</p>
      <p className="result-position" role="status">{formatMessage(copy.resultPosition, { current: index + 1, total: candidates.length })}</p>
      {state === 'limited_search' && <p className="limited-search">{copy.limitedSearch}</p>}
      {state === 'needs_more_detail' && <div className="refinement"><p>{copy.needsMoreDetail}</p><p>{copy.noSave}</p></div>}
      <article className="candidate-card" aria-label={copy.selectedResult}>
        <span className="match-dot" aria-hidden="true" />
        <div><h3>{candidate.name}{candidate.latin_name && <> <span>/</span> {candidate.latin_name}</>}</h3><p>{candidate.relative_name}</p><p>{candidate.locality}</p><p>{formatMessage(copy.ageInRollYear, { age: candidate.age ?? '' })}</p></div>
        <button className="candidate-next" type="button" onClick={onNext} disabled={index >= candidates.length - 1} aria-label={copy.nextResult}><span>{copy.nextResult}</span><Chevron /></button>
      </article>
      {reasons.length > 0 && <>
        <h3 className="why-heading">{copy.whatMatched}</h3>
        <ul className="reasons">{reasons.map((reason) => <li key={`${reason.field}-${reason.value}`}><span><b>{displayFieldLabel(reason.field, copy)}:</b> “{reason.value}”</span><strong>{displayMatchLabel(reason.match, language)}</strong></li>)}</ul>
      </>}
      <div className="candidate-actions">
        <button type="button" className="secondary-button" onClick={onPrevious} disabled={index === 0} aria-label={copy.previousResult}><Chevron direction="left" />{copy.previous}</button>
        {state === 'needs_more_detail'
          ? <button type="button" className="primary-button" onClick={onEditSearch}>{copy.editSearch}<Chevron /></button>
          : <button type="button" className="primary-button" onClick={onVerify}>{copy.verifySource}<Chevron /></button>}
      </div>
    </section>
  )
}
