import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { displayMatchLabel, messages } from './i18n'
import { AppHeader } from './components/AppHeader'
import { StepProgress } from './components/StepProgress'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expectMatchingCatalogueShape(english: unknown, kannada: unknown, path = 'messages'): void {
  if (isRecord(english)) {
    expect(isRecord(kannada), `${path} should be an object in both languages`).toBe(true)
    if (!isRecord(kannada)) return
    expect(Object.keys(kannada).sort()).toEqual(Object.keys(english).sort())
    for (const key of Object.keys(english)) {
      expectMatchingCatalogueShape(english[key], kannada[key], `${path}.${key}`)
    }
    return
  }

  expect(typeof english, `${path} should be a text leaf`).toBe('string')
  expect(typeof kannada, `${path} should have Kannada text`).toBe('string')
  expect((kannada as string).trim(), `${path} should not be empty`).not.toBe('')
}

describe('i18n catalogue', () => {
  it('gives every English message leaf a non-empty Kannada counterpart with no structure drift', () => {
    expectMatchingCatalogueShape(messages.en, messages.kn)
  })

  it.each([
    ['Exact match', 'Exact match', 'ನಿಖರ ಹೊಂದಾಣಿಕೆ'],
    ['Close match', 'Close match', 'ಹತ್ತಿರದ ಹೊಂದಾಣಿಕೆ'],
    ['Related match', 'Related match', 'ಸಂಬಂಧಿತ ಹೊಂದಾಣಿಕೆ'],
    ['Unexpected backend label', 'Unexpected backend label', 'Unexpected backend label'],
  ])('localizes %s without hiding unknown backend values', (value, english, kannada) => {
    expect(displayMatchLabel(value, 'en')).toBe(english)
    expect(displayMatchLabel(value, 'kn')).toBe(kannada)
  })

  it('keeps the localized full progress sequence semantic alongside its compact mobile summary', () => {
    render(createElement(StepProgress, { active: 'person', copy: messages.kn.progress }))

    expect(screen.getByRole('navigation', { name: 'ಹುಡುಕಾಟದ ಹಂತಗಳು' })).toBeTruthy()
    expect(screen.getByText('ಹಂತ 1 / 3 - ವ್ಯಕ್ತಿಯ ವಿವರಗಳು').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('listitem', { name: 'ವ್ಯಕ್ತಿಯ ವಿವರಗಳು' }).getAttribute('aria-current')).toBe('step')
  })

  it('keeps the shared header usable without a language action', () => {
    render(createElement(AppHeader, { route: 'search', onNavigate: () => undefined, copy: messages.en.header }))

    expect(screen.queryByRole('button', { name: 'Switch to Kannada' })).toBeNull()
  })
})
