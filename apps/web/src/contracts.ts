export type JourneyStep = 'collection' | 'person' | 'candidate' | 'evidence'

export type SearchState =
  | 'possible_match'
  | 'needs_more_detail'
  | 'no_confident_result'
  | 'limited_search'

export interface SearchRequest {
  name: string
  relative_name?: string
  locality?: string
  age?: number
  limit?: number
}

export interface MatchReason {
  field: string
  query?: string
  value: string
  match: string
}

export interface SearchCandidate {
  synthetic_id: string
  name: string
  latin_name?: string
  relative_name?: string
  locality?: string
  age?: number
  evidence_id: string
  source_part?: string
  source_page?: number
  match_reasons?: MatchReason[]
}

export interface SearchResponse {
  state: SearchState
  candidates: SearchCandidate[]
}

export interface DemoExample {
  id: string
  label: 'Exact Kannada' | 'Romanized typo' | 'Needs refinement' | 'No confident match'
  query: SearchRequest
  refinement?: Partial<SearchRequest>
  expected_state: SearchState
  expected_refined_state?: SearchState
  expected_record_id?: string
}
