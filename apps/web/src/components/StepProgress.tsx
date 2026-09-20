import type { JourneyStep } from '../contracts'
import { formatMessage, type Messages } from '../i18n'

const steps: Array<{ id: JourneyStep; copyKey: keyof Pick<Messages['progress'], 'personDetails' | 'possibleMatches' | 'verifySource'> }> = [
  { id: 'person', copyKey: 'personDetails' },
  { id: 'candidate', copyKey: 'possibleMatches' },
  { id: 'evidence', copyKey: 'verifySource' },
]

export function StepProgress({ active, copy }: { active: JourneyStep; copy: Messages['progress'] }) {
  const activeIndex = steps.findIndex((step) => step.id === active)
  const activeStep = steps[activeIndex]
  return (
    <nav className="progress" aria-label={copy.label}>
      <p className="mobile-progress-summary" aria-hidden="true">{formatMessage(copy.mobileSummary, { current: activeIndex + 1, total: steps.length, step: copy[activeStep.copyKey] })}</p>
      <ol className="progress-steps">
        {steps.map((step, index) => (
          <li className="progress-item" key={step.id} aria-label={copy[step.copyKey]} aria-current={index === activeIndex ? 'step' : undefined}>
            <div className="progress-number" data-active={index === activeIndex || undefined}>
              {index + 1}
            </div>
            <span>{copy[step.copyKey]}</span>
            {index < steps.length - 1 && <i aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </nav>
  )
}
