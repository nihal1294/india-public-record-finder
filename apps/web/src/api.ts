import type { DemoExample, SearchRequest, SearchResponse } from './contracts'

export interface ApiClient {
  search(query: SearchRequest): Promise<SearchResponse>
  examples(): Promise<DemoExample[]>
  evidenceUrl(evidenceId: string): string
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const apiClient: ApiClient = {
  search: (query) =>
    requestJson<SearchResponse>('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...query, limit: query.limit ?? 5 }),
    }),
  examples: () => requestJson<DemoExample[]>('/api/examples'),
  evidenceUrl: (evidenceId) => `/api/evidence/${encodeURIComponent(evidenceId)}`,
}
