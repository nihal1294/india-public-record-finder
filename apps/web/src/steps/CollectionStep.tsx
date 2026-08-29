import type { Messages } from '../i18n'

export function CollectionStep({ copy }: { copy: Messages['collection'] }) {
  return (
    <div className="collection-copy">
      <h1 id="journey-title">{copy.heading}</h1>
      <p className="collection-name">{copy.subheading}</p>
    </div>
  )
}
