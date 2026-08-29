import { useEffect, useRef, useState } from 'react'

import type { Messages } from '../i18n'
import type { AppRoute } from '../useAppRoute'

interface HeaderAction {
  label: string
  onActivate: () => void
}

interface AppHeaderProps {
  route: AppRoute
  onNavigate: (route: AppRoute) => void
  copy: Messages['header']
  languageAction?: HeaderAction
  aboutAction?: HeaderAction
}

export function AppHeader({ route, onNavigate, copy, languageAction, aboutAction }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMenuOpen(false)
      menuButton.current?.focus()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  const navigate = (nextRoute: AppRoute) => {
    setMenuOpen(false)
    onNavigate(nextRoute)
  }

  const activate = (action: HeaderAction) => {
    setMenuOpen(false)
    action.onActivate()
  }

  const handleWordmark = () => {
    navigate('search')
  }

  const navigationLabel = route === 'demo-data' ? copy.backToSearch : copy.browseDemoData
  const navigationTarget: AppRoute = route === 'demo-data' ? 'search' : 'demo-data'

  return (
    <header className="site-header">
      <button type="button" className="wordmark" lang="en" onClick={handleWordmark}>{copy.wordmark}</button>
      <button ref={menuButton} type="button" className="menu-button" aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen((open) => !open)}>{copy.menu}</button>
      <nav id="site-navigation" aria-label={copy.siteNavigation} data-open={menuOpen}>
        <button type="button" onClick={() => navigate(navigationTarget)}>{navigationLabel}</button>
        {languageAction && <button type="button" onClick={() => activate(languageAction)}>{languageAction.label}</button>}
        {aboutAction && <button type="button" onClick={() => activate(aboutAction)}>{aboutAction.label}</button>}
      </nav>
    </header>
  )
}
