import { useEffect, useRef, useState } from 'react'

import { apiClient, type ApiClient } from './api'
import { AppHeader } from './components/AppHeader'
import { AboutDialog } from './components/AboutDialog'
import { BlankResultGuide } from './components/BlankResultGuide'
import { DemoDataExplorer } from './components/DemoDataExplorer'
import { ExampleScenarios } from './components/ExampleScenarios'
import { StepProgress } from './components/StepProgress'
import type { DemoExample, DemoRecord, JourneyStep, SearchRequest, SearchResponse } from './contracts'
import { fallbackExamples } from './examples'
import { messages, type Language } from './i18n'
import { CandidateStep } from './steps/CandidateStep'
import { EvidenceStep } from './steps/EvidenceStep'
import { PersonStep } from './steps/PersonStep'
import { useAppRoute } from './useAppRoute'

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
  const { route, navigate } = useAppRoute()
  const [language, setLanguage] = useState<Language>('en')
  const [step, setStep] = useState<JourneyStep>('person')
  const [query, setQuery] = useState<SearchRequest>(emptyQuery)
  const [submittedQuery, setSubmittedQuery] = useState<SearchRequest | null>(null)
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [examples, setExamples] = useState<DemoExample[]>(fallbackExamples)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const [hasServiceError, setHasServiceError] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const firstOptionalFieldRef = useRef<HTMLInputElement>(null)
  const localityFieldRef = useRef<HTMLInputElement>(null)
  const ageFieldRef = useRef<HTMLInputElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  const searchGeneration = useRef(0)
  const copy = messages[language]

  useEffect(() => {
    const priorLanguage = document.documentElement.lang
    document.documentElement.lang = language
    return () => {
      document.documentElement.lang = priorLanguage
    }
  }, [language])

  useEffect(() => {
    if (route !== 'search') return
    let current = true
    api.examples().then((items) => {
      if (current && hasCompleteExampleSet(items)) setExamples(items)
    }).catch(() => undefined)
    return () => { current = false }
  }, [api, route])

  useEffect(() => {
    const invalidateSearchOnDemoHistoryNavigation = () => {
      if (window.location.pathname !== '/demo-data' && window.location.pathname !== '/demo-data/') return
      searchGeneration.current += 1
      setSearching(false)
    }
    window.addEventListener('popstate', invalidateSearchOnDemoHistoryNavigation)
    return () => window.removeEventListener('popstate', invalidateSearchOnDemoHistoryNavigation)
  }, [])

  useEffect(() => {
    if (!response) return
    const heading = document.getElementById(step === 'evidence' ? 'evidence-heading' : 'result-heading')
    heading?.focus()
  }, [response, step])

  const runSearch = async (request = query) => {
    if (!request.name.trim()) return
    const generation = ++searchGeneration.current
    setSearching(true)
    setHasServiceError(false)
    setStep('person')
    setResponse(null)
    setSubmittedQuery(null)
    try {
      const submitted = cleanQuery(request)
      const result = await api.search(submitted)
      if (generation !== searchGeneration.current) return
      setQuery(request)
      setSubmittedQuery(submitted)
      setResponse(result)
      setCandidateIndex(0)
      setStep(nextStepFor(result))
    } catch {
      if (generation !== searchGeneration.current) return
      setResponse(null)
      setSubmittedQuery(null)
      setCandidateIndex(0)
      setHasServiceError(true)
      setStep('person')
    } finally {
      if (generation === searchGeneration.current) setSearching(false)
    }
  }

  const chooseExample = (example: DemoExample) => {
    setHasServiceError(false)
    setQuery(example.query)
    setShowDetails(Boolean(example.query.relative_name || example.query.locality || example.query.age))
    setResponse(null)
    setSubmittedQuery(null)
    setStep('person')
    queueMicrotask(() => submitButtonRef.current?.focus())
  }
  const useDemoSample = (record: DemoRecord) => {
    setQuery({ name: record.name, relative_name: record.relative_name, locality: record.locality, age: record.age })
    setShowDetails(true)
    setResponse(null)
    setSubmittedQuery(null)
    setHasServiceError(false)
    setStep('person')
    handleNavigate('search')
    queueMicrotask(() => submitButtonRef.current?.focus())
  }
  const updateQuery = (nextQuery: SearchRequest) => {
    searchGeneration.current += 1
    setSearching(false)
    setHasServiceError(false)
    setQuery(nextQuery)
  }
  const reset = () => {
    searchGeneration.current += 1
    setSearching(false)
    setStep('person'); setQuery(emptyQuery); setSubmittedQuery(null); setResponse(null); setShowDetails(false)
    setCandidateIndex(0); setHasServiceError(false)
  }

  const candidates = response?.candidates ?? []
  const candidate = candidates[candidateIndex]
  const moveCandidate = (direction: -1 | 1) => {
    setCandidateIndex((current) => Math.min(Math.max(current + direction, 0), candidates.length - 1))
  }
  const verify = () => { if (candidate) setStep('evidence') }
  const editSearch = () => {
    setResponse(null)
    setSubmittedQuery(null)
    setShowDetails(true)
    setStep('person')
    const firstMissingField = !query.relative_name ? firstOptionalFieldRef : !query.locality ? localityFieldRef : !query.age ? ageFieldRef : firstOptionalFieldRef
    queueMicrotask(() => firstMissingField.current?.focus())
  }
  const handleNavigate = (nextRoute: typeof route) => {
    if (route === 'search' && nextRoute !== 'search') {
      searchGeneration.current += 1
      setSearching(false)
    }
    navigate(nextRoute)
  }
  const toggleLanguage = () => {
    setLanguage((current) => current === 'en' ? 'kn' : 'en')
  }
  const languageAction = { label: copy.header.switchLanguage, onActivate: toggleLanguage }
  const aboutAction = { label: copy.header.about, onActivate: () => setShowAbout(true) }

  if (route === 'demo-data') {
    return (
      <div className="app-shell" lang={language}>
        <AppHeader route={route} onNavigate={handleNavigate} copy={copy.header} languageAction={languageAction} aboutAction={aboutAction} />
        <DemoDataExplorer copy={copy.demo} api={api} onUseSample={useDemoSample} />
        {showAbout && <AboutDialog copy={copy.about} closeLabel={copy.evidence.close} onClose={() => setShowAbout(false)} />}
      </div>
    )
  }

  return (
    <div className="app-shell" lang={language} data-has-results={response ? 'true' : 'false'}>
      <AppHeader route={route} onNavigate={handleNavigate} copy={copy.header} languageAction={languageAction} aboutAction={aboutAction} />
      <StepProgress active={step} copy={copy.progress} />
      <main id="top" className="journey-layout">
        <section className="search-panel" aria-labelledby="journey-title">
          <div className="collection-copy">
            <h1 id="journey-title">{copy.collection.heading}</h1>
            <p className="collection-name">{copy.collection.subheading}</p>
          </div>
          <section className="prototype-banner" aria-label={copy.safety.notice}><p>{copy.safety.notice}</p></section>
          {response && submittedQuery && <section className="search-summary" aria-label={copy.search.summaryRegionLabel}><div className="search-summary-heading"><SummaryIcon /><h2>{copy.search.summaryHeading}</h2><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 9 7 7 7-7" /></svg></div><div className="search-summary-fields"><p>{copy.search.summaryName}: “{submittedQuery.name}”</p>{submittedQuery.relative_name && <p>{copy.search.summaryRelative}: “{submittedQuery.relative_name}”</p>}{submittedQuery.locality && <p>{copy.search.summaryLocality}: “{submittedQuery.locality}”</p>}{submittedQuery.age && <p>{copy.search.summaryAge}: {submittedQuery.age}</p>}</div></section>}
          <PersonStep query={query} onChange={updateQuery} onSearch={() => void runSearch()} searching={searching} showDetails={showDetails} onShowDetailsChange={setShowDetails} copy={copy.person} firstOptionalFieldRef={firstOptionalFieldRef} localityFieldRef={localityFieldRef} ageFieldRef={ageFieldRef} submitButtonRef={submitButtonRef} />
          {hasServiceError && <p className="form-error" role="alert">{copy.search.unavailable}</p>}
          <ExampleScenarios examples={examples} copy={copy.examples} onChoose={chooseExample} disabled={searching} />
          <button type="button" className="reset-button" onClick={reset}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></svg>{copy.search.reset}</button>
        </section>
        <section className="result-panel" aria-label={copy.search.resultsRegionLabel}>
          {!response && <BlankResultGuide copy={copy.blankGuide} />}
          {response && <CandidateStep state={response.state} candidates={candidates} index={candidateIndex} onPrevious={() => moveCandidate(-1)} onNext={() => moveCandidate(1)} onVerify={verify} onEditSearch={editSearch} copy={copy.results} language={language} />}
          {step === 'evidence' && candidate && <EvidenceStep key={candidate.evidence_id} candidate={candidate} source={api.evidenceUrl(candidate.evidence_id)} copy={copy.evidence} />}
        </section>
      </main>
      {showAbout && <AboutDialog copy={copy.about} closeLabel={copy.evidence.close} onClose={() => setShowAbout(false)} />}
    </div>
  )
}
