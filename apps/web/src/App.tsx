import { useEffect, useState } from 'react'

import { apiClient, type ApiClient } from './api'
import { PrototypeBanner } from './components/PrototypeBanner'
import { StepProgress } from './components/StepProgress'
import type { DemoExample, JourneyStep, SearchRequest, SearchResponse } from './contracts'
import { fallbackExamples } from './examples'
import { CandidateStep } from './steps/CandidateStep'
import { CollectionStep } from './steps/CollectionStep'
import { EvidenceStep } from './steps/EvidenceStep'
import { PersonStep } from './steps/PersonStep'

const emptyQuery: SearchRequest = { name: '' }
const expectedExamples = new Map(fallbackExamples.map((example) => [example.id, example.label]))

function nextStepFor(response: SearchResponse): JourneyStep {
  return response.state === 'no_confident_result' ? 'person' : 'candidate'
}

function cleanQuery(query: SearchRequest): SearchRequest {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== undefined)) as SearchRequest
}

function hasCompleteExampleSet(items: DemoExample[]): boolean {
  return items.length === expectedExamples.size && new Set(items.map((item) => item.id)).size === expectedExamples.size
    && items.every((item) => expectedExamples.get(item.id) === item.label)
}

function SummaryIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 6h2m4 0h8M5 12h2m4 0h8M5 18h2m4 0h8" /></svg>
}

export default function App({ api = apiClient }: { api?: ApiClient }) {
  const [step, setStep] = useState<JourneyStep>('collection')
  const [query, setQuery] = useState<SearchRequest>(emptyQuery)
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [examples, setExamples] = useState<DemoExample[]>(fallbackExamples)
  const [activeExample, setActiveExample] = useState<DemoExample | null>(null)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [showEvidence, setShowEvidence] = useState(false)

  useEffect(() => {
    let current = true
    api.examples().then((items) => {
      if (current && hasCompleteExampleSet(items)) setExamples(items)
    }).catch(() => undefined)
    return () => { current = false }
  }, [api])

  useEffect(() => {
    if (!response) return
    const heading = document.getElementById(step === 'evidence' ? 'evidence-heading' : 'result-heading')
    heading?.focus()
  }, [response, step])

  const runSearch = async (request = query, example: DemoExample | null = activeExample) => {
    if (!request.name.trim()) return
    setSearching(true)
    setError('')
    setShowEvidence(false)
    try {
      const result = await api.search(cleanQuery(request))
      setQuery(request)
      setResponse(result)
      setActiveExample(example)
      setCandidateIndex(0)
      setStep(nextStepFor(result))
    } catch {
      setError('Search is unavailable. Try again.')
      setStep('person')
    } finally {
      setSearching(false)
    }
  }

  const chooseExample = (example: DemoExample) => {
    setQuery(example.query)
    void runSearch(example.query, example)
  }
  const applyDetails = () => {
    if (activeExample?.refinement) void runSearch({ ...activeExample.query, ...activeExample.refinement } as SearchRequest, activeExample)
  }
  const reset = () => {
    setStep('collection'); setQuery(emptyQuery); setResponse(null); setActiveExample(null)
    setCandidateIndex(0); setShowEvidence(false); setError('')
  }

  const candidates = response?.candidates ?? []
  const candidate = candidates[candidateIndex]
  const moveCandidate = (direction: -1 | 1) => {
    if (candidates.length > 1) setCandidateIndex((current) => (current + direction + candidates.length) % candidates.length)
  }
  const verify = () => { if (candidate) { setShowEvidence(true); setStep('evidence') } }

  return (
    <div className="app-shell" data-has-results={response ? 'true' : 'false'}>
      <header className="site-header">
        <a className="wordmark" href="#top">India Public Record Finder</a>
        <nav aria-label="Site"><span className="language-label">English / ಕನ್ನಡ</span><a className="about-link" href="#prototype">About this prototype</a></nav>
      </header>
      <StepProgress active={step} />
      <main id="top" className="journey-layout">
        <section className="search-panel" aria-labelledby="journey-title">
          <div id="prototype"><CollectionStep /><PrototypeBanner /></div>
          {response && <section className="search-summary" aria-label="Your search"><div className="search-summary-heading"><SummaryIcon /><h2>Your search</h2><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 9 7 7 7-7" /></svg></div><div className="search-summary-fields"><p>Name: “{query.name}”</p>{query.relative_name && <p>Relative: “{query.relative_name}”</p>}{query.locality && <p>Locality: “{query.locality}”</p>}{query.age && <p>Age: {query.age}</p>}</div></section>}
          <PersonStep query={query} onChange={setQuery} onSearch={() => void runSearch()} searching={searching} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <section className="examples" aria-label="Try these examples"><h2>Try these examples</h2><div>{examples.map((example) => <button type="button" key={example.id} onClick={() => chooseExample(example)} disabled={searching}>{example.label}</button>)}</div></section>
          <button type="button" className="reset-button" onClick={reset}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></svg>Reset</button>
        </section>
        <section className="result-panel" aria-label="Search results">
          {response && <CandidateStep state={response.state} candidates={candidates} index={candidateIndex} onPrevious={() => moveCandidate(-1)} onNext={() => moveCandidate(1)} onVerify={verify} onApplyDetails={applyDetails} />}
          {showEvidence && candidate && <EvidenceStep key={candidate.evidence_id} candidate={candidate} source={api.evidenceUrl(candidate.evidence_id)} />}
        </section>
      </main>
    </div>
  )
}
