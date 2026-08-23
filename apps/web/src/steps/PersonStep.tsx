import type { FormEvent } from 'react'

import type { SearchRequest } from '../contracts'

export function PersonStep({
  query,
  onChange,
  onSearch,
  searching,
}: {
  query: SearchRequest
  onChange: (query: SearchRequest) => void
  onSearch: () => void
  searching: boolean
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
      <label>
        Name
        <input aria-label="Name" required value={query.name} onChange={(event) => update('name', event.target.value)} />
      </label>
      <label>
        Relative&apos;s name <em>(optional)</em>
        <input aria-label="Relative's name (optional)" value={query.relative_name ?? ''} onChange={(event) => update('relative_name', event.target.value)} />
      </label>
      <label>
        Locality <em>(optional)</em>
        <input aria-label="Locality (optional)" value={query.locality ?? ''} onChange={(event) => update('locality', event.target.value)} />
      </label>
      <label>
        Age in roll year <em>(optional)</em>
        <input aria-label="Age in roll year (optional)" type="number" min="1" max="120" value={query.age ?? ''} onChange={(event) => update('age', event.target.value)} />
      </label>
      <button className="primary-button" disabled={searching || !query.name.trim()} type="submit">
        {searching ? 'Finding possible matches' : 'Find possible matches'}
      </button>
    </form>
  )
}
