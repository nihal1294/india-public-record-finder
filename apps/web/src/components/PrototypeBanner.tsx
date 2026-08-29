import type { Messages } from '../i18n'

export function PrototypeBanner({ copy }: { copy: Messages['prototype'] }) {
  return (
    <section className="prototype-banner" aria-label={copy.boundary}>
      <p>{copy.independentPrototype}</p>
      <p>{copy.syntheticDataOnly}</p>
      <p>{copy.doNotEnterPersonalInformation}</p>
    </section>
  )
}
