import type { JourneyStep } from '../contracts'

const steps: Array<{ id: JourneyStep; label: string; number: number }> = [
  { id: 'collection', label: 'Collection', number: 1 },
  { id: 'person', label: 'Person details', number: 2 },
  { id: 'candidate', label: 'Possible matches', number: 3 },
  { id: 'evidence', label: 'Verify source', number: 4 },
]

export function StepProgress({ active }: { active: JourneyStep }) {
  const activeIndex = steps.findIndex((step) => step.id === active)
  return (
    <nav className="progress" aria-label="Search progress">
      {steps.map((step, index) => (
        <div className="progress-item" key={step.id}>
          <div className="progress-number" data-active={index === activeIndex || undefined}>
            {step.number}
          </div>
          <span>{step.label}</span>
          {index < steps.length - 1 && <i aria-hidden="true" />}
        </div>
      ))}
    </nav>
  )
}
