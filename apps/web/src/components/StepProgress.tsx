import type { JourneyStep } from '../contracts'
import { formatMessage, type Messages } from '../i18n'

const steps: Array<{ id: JourneyStep; copyKey: keyof Pick<Messages['progress'], 'collection' | 'personDetails' | 'possibleMatches' | 'verifySource'>; number: number }> = [
  { id: 'collection', copyKey: 'collection', number: 1 },
  { id: 'person', copyKey: 'personDetails', number: 2 },
  { id: 'candidate', copyKey: 'possibleMatches', number: 3 },
  { id: 'evidence', copyKey: 'verifySource', number: 4 },
]

export function StepProgress({ active, copy }: { active: JourneyStep; copy: Messages['progress'] }) {
  const activeIndex = steps.findIndex((step) => step.id === active)
  const activeStep = steps[activeIndex]
  return (
    <nav className="progress" aria-label={copy.label}>
      <p className="mobile-progress-summary" aria-hidden="true">{formatMessage(copy.mobileSummary, { current: activeIndex + 1, step: copy[activeStep.copyKey] })}</p>
      <ol className="progress-steps">
        {steps.map((step, index) => (
          <li className="progress-item" key={step.id} aria-label={copy[step.copyKey]} aria-current={index === activeIndex ? 'step' : undefined}>
            <div className="progress-number" data-active={index === activeIndex || undefined}>
              {step.number}
            </div>
            <span>{copy[step.copyKey]}</span>
            {index < steps.length - 1 && <i aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </nav>
  )
}
