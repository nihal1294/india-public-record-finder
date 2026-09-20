import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

const dialogStack: symbol[] = []
let bodyLockCount = 0
let bodyStyleBeforeLock: string | null = null

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
}

function lockBody() {
  if (bodyLockCount === 0) {
    bodyStyleBeforeLock = document.body.getAttribute('style')
    document.body.style.overflow = 'hidden'
  }
  bodyLockCount += 1
}

function unlockBody() {
  bodyLockCount -= 1
  if (bodyLockCount !== 0) return
  if (bodyStyleBeforeLock === null) document.body.removeAttribute('style')
  else document.body.setAttribute('style', bodyStyleBeforeLock)
  bodyStyleBeforeLock = null
}

function isTopmostDialog(id: symbol) {
  return dialogStack.at(-1) === id
}

export function ModalDialog({ title, closeLabel, onClose, children }: {
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const dialogId = useRef(Symbol('modal-dialog'))
  const latestOnClose = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    latestOnClose.current = onClose
  }, [onClose])

  useEffect(() => {
    const id = dialogId.current
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogStack.push(id)
    lockBody()
    focusableElements(dialogRef.current ?? document.body)[0]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostDialog(id)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        latestOnClose.current()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      const elements = focusableElements(dialog ?? document.body)
      if (elements.length === 0) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      const wasTopmost = isTopmostDialog(id)
      const stackIndex = dialogStack.lastIndexOf(id)
      if (stackIndex !== -1) dialogStack.splice(stackIndex, 1)
      unlockBody()
      if (wasTopmost && triggerRef.current?.isConnected) triggerRef.current.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && isTopmostDialog(dialogId.current)) latestOnClose.current() }}>
      <div ref={dialogRef} className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-dialog-header"><h2 id={titleId}>{title}</h2><button type="button" onClick={() => latestOnClose.current()}>{closeLabel}</button></div>
        <div className="modal-dialog-body">{children}</div>
      </div>
    </div>
  )
}
