import { useCallback, useEffect, useState } from 'react'

export type AppRoute = 'search' | 'demo-data'

export interface AppRouteState {
  route: AppRoute
  navigate: (route: AppRoute) => void
}

function routeForPathname(pathname: string): AppRoute {
  return pathname === '/demo-data' || pathname === '/demo-data/' ? 'demo-data' : 'search'
}

function pathnameForRoute(route: AppRoute): string {
  return route === 'demo-data' ? '/demo-data' : '/'
}

function canonicalizeLocation(route: AppRoute): void {
  const pathname = pathnameForRoute(route)
  if (
    window.location.pathname !== pathname
    || window.location.search !== ''
    || window.location.hash !== ''
  ) {
    window.history.replaceState(window.history.state, '', pathname)
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'auto' })
}

export function useAppRoute(): AppRouteState {
  const [route, setRoute] = useState(() => routeForPathname(window.location.pathname))

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = routeForPathname(window.location.pathname)
      canonicalizeLocation(nextRoute)
      setRoute(nextRoute)
      scrollToTop()
    }
    canonicalizeLocation(routeForPathname(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((nextRoute: AppRoute) => {
    const pathname = pathnameForRoute(nextRoute)
    const isCleanSameRoute = routeForPathname(window.location.pathname) === nextRoute
      && window.location.pathname === pathname
      && window.location.search === ''
      && window.location.hash === ''
    if (isCleanSameRoute) {
      scrollToTop()
      return
    }
    if (routeForPathname(window.location.pathname) === nextRoute) {
      window.history.replaceState(window.history.state, '', pathname)
    } else {
      window.history.pushState({}, '', pathname)
    }
    setRoute(nextRoute)
    scrollToTop()
  }, [])

  return { route, navigate }
}
