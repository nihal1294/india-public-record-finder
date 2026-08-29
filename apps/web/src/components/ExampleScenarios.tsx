import type { DemoExample } from '../contracts'
import { formatMessage, type Messages } from '../i18n'

const scenarioCopy = {
  'exact-kannada': 'exactKannada',
  'romanized-typo': 'romanizedTypo',
  'needs-refinement': 'needsRefinement',
  'no-confident-match': 'noConfidentMatch',
} as const

export function ExampleScenarios({ examples, copy, onChoose, disabled }: {
  examples: DemoExample[]
  copy: Messages['examples']
  onChoose: (example: DemoExample) => void
  disabled: boolean
}) {
  return (
    <section className="examples" aria-labelledby="fictional-examples-heading">
      <h2 id="fictional-examples-heading">{copy.heading}</h2>
      <div className="example-cards">
        {examples.map((example) => {
          const scenario = copy[scenarioCopy[example.id as keyof typeof scenarioCopy]]
          return <article className="example-card" key={example.id}>
            <p className="fictional-marker">{copy.fictionalMarker}</p>
            <h3>{scenario.title}</h3>
            <p>{scenario.description}</p>
            <button type="button" className="text-button" aria-label={formatMessage(copy.useExample, { scenario: scenario.title })} onClick={() => onChoose(example)} disabled={disabled}>{copy.useExample.replace(': {scenario}', '')}</button>
          </article>
        })}
      </div>
    </section>
  )
}
