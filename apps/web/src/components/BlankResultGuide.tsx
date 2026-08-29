import type { Messages } from '../i18n'

export function BlankResultGuide({ copy }: { copy: Messages['blankGuide'] }) {
  return (
    <section className="blank-result-guide" aria-labelledby="blank-guide-heading">
      <h2 id="blank-guide-heading">{copy.heading}</h2>
      <ol>
        <li>{copy.enterName}</li>
        <li>{copy.addDetails}</li>
        <li>{copy.compareMatches}</li>
      </ol>
      <p>{copy.privacy}</p>
    </section>
  )
}
