import type { FormEvent, RefObject } from 'react'

import type { SearchRequest } from '../contracts'
import type { Messages } from '../i18n'

export function PersonStep({
  query,
  onChange,
  onSearch,
  searching,
  showDetails,
  onShowDetailsChange,
  copy,
  firstOptionalFieldRef,
  localityFieldRef,
  ageFieldRef,
  submitButtonRef,
}: {
  query: SearchRequest
  onChange: (query: SearchRequest) => void
  onSearch: () => void
  searching: boolean
  showDetails: boolean
  onShowDetailsChange: (showDetails: boolean) => void
  copy: Messages['person']
  firstOptionalFieldRef?: RefObject<HTMLInputElement | null>
  localityFieldRef?: RefObject<HTMLInputElement | null>
  ageFieldRef?: RefObject<HTMLInputElement | null>
  submitButtonRef?: RefObject<HTMLButtonElement | null>
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSearch()
  }
  const update = (field: keyof SearchRequest, value: string) => {
    onChange({ ...query, [field]: field === 'age' ? (value === '' ? undefined : Number(value)) : value })
  }

  return (
    <form className="person-form" onSubmit={submit}>
      <label htmlFor="person-name">
        {copy.name}
        <input id="person-name" aria-describedby="name-helper" required placeholder={copy.namePlaceholder} value={query.name} onChange={(event) => update('name', event.target.value)} />
      </label>
      <p id="name-helper" className="field-helper">{copy.nameHelper}</p>
      <button type="button" className="text-button details-disclosure" aria-expanded={showDetails} aria-controls="optional-details" onClick={() => onShowDetailsChange(!showDetails)}>{showDetails ? copy.hideExtraDetails : copy.addMoreDetails}</button>
      {showDetails && <div id="optional-details" className="optional-details">
        <label htmlFor="relative-name">
          {copy.relativeName} <em>({copy.optional})</em>
          <input ref={firstOptionalFieldRef} id="relative-name" aria-describedby="relative-helper" value={query.relative_name ?? ''} onChange={(event) => update('relative_name', event.target.value)} />
        </label>
        <p id="relative-helper" className="field-helper">{copy.relativeHelper}</p>
        <label htmlFor="locality">
          {copy.locality} <em>({copy.optional})</em>
          <input ref={localityFieldRef} id="locality" aria-describedby="locality-helper" value={query.locality ?? ''} onChange={(event) => update('locality', event.target.value)} />
        </label>
        <p id="locality-helper" className="field-helper">{copy.localityHelper}</p>
        <label htmlFor="roll-year-age">
          {copy.ageInRollYear} <em>({copy.optional})</em>
          <input ref={ageFieldRef} id="roll-year-age" aria-describedby="age-helper" type="number" min="1" max="120" value={query.age ?? ''} onChange={(event) => update('age', event.target.value)} />
        </label>
        <p id="age-helper" className="field-helper">{copy.ageHelper}</p>
      </div>}
      <button ref={submitButtonRef} className="primary-button" disabled={searching || !query.name.trim()} type="submit">
        {searching ? copy.submitting : copy.submit}
      </button>
    </form>
  )
}
