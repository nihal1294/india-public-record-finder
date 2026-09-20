import { createElement } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppRoute } from './useAppRoute'

function RouteProbe() {
  const { route, navigate } = useAppRoute()
  return createElement('div', null,
    createElement('output', null, route),
    createElement('button', { type: 'button', onClick: () => navigate('demo-data') }, 'Demo'),
    createElement('button', { type: 'button', onClick: () => navigate('search') }, 'Search'),
  )
}

beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined))
afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

describe('useAppRoute', () => {
  it.each([
    ['/', 'search'],
    ['/demo-data', 'demo-data'],
    ['/demo-data/', 'demo-data'],
    ['/demo-data/?legacy=true', 'demo-data'],
    ['/not-a-route', 'search'],
  ] as const)('maps %s to %s', (path, expectedRoute) => {
    window.history.replaceState({}, '', path)
    render(createElement(RouteProbe))

    expect(screen.getByText(expectedRoute)).toBeTruthy()
  })

  it.each([
    ['/?stale=1#top', 'search', '/'],
    ['/demo-data/?stale=1#top', 'demo-data', '/demo-data'],
    ['/demo-data/', 'demo-data', '/demo-data'],
    ['/unknown-route?stale=1#top', 'search', '/'],
  ] as const)('canonicalizes an initial %s location to %s', (initialPath, expectedRoute, canonicalPath) => {
    window.history.replaceState({}, '', initialPath)
    const replaceState = vi.spyOn(window.history, 'replaceState')

    render(createElement(RouteProbe))

    expect(screen.getByText(expectedRoute)).toBeTruthy()
    expect(replaceState).toHaveBeenCalledWith({}, '', canonicalPath)
    expect(window.location.pathname).toBe(canonicalPath)
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
  })

  it('navigates without query parameters or fragments', async () => {
    const user = userEvent.setup()
    render(createElement(RouteProbe))

    await user.click(screen.getByRole('button', { name: 'Demo' }))
    expect(window.location.pathname).toBe('/demo-data')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')

    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(window.location.pathname).toBe('/')
  })

  it('updates when browser history changes', () => {
    render(createElement(RouteProbe))

    act(() => {
      window.history.pushState({}, '', '/demo-data')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(screen.getByText('demo-data')).toBeTruthy()
  })

  it.each([
    ['/', 'Search'],
    ['/demo-data', 'Demo'],
  ] as const)('does not add history for clean same-route navigation from %s', async (path, action) => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', path)
    render(createElement(RouteProbe))
    const pushState = vi.spyOn(window.history, 'pushState')

    await user.click(screen.getByRole('button', { name: action }))

    expect(pushState).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe(path)
  })

  it.each([
    ['/?legacy=true#top', 'Search', '/'],
    ['/demo-data/?legacy=true#top', 'Demo', '/demo-data'],
  ] as const)('canonicalizes a stale same-route URL without adding history from %s', async (stalePath, action, canonicalPath) => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', stalePath)
    const pushState = vi.spyOn(window.history, 'pushState')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    render(createElement(RouteProbe))

    await user.click(screen.getByRole('button', { name: action }))

    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState).toHaveBeenCalledWith({}, '', canonicalPath)
    expect(window.location.pathname).toBe(canonicalPath)
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
  })
})
