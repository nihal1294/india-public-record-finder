import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { ModalDialog } from './ModalDialog'

function dispatchTab(shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
  window.dispatchEvent(event)
  return event
}

afterEach(() => {
  document.body.removeAttribute('style')
})

describe('ModalDialog', () => {
  it('closes through Escape and restores the trigger and exact body style', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><button type="button" onClick={() => setOpen(true)}>Open details</button>{open && <ModalDialog title="Details" closeLabel="Close" onClose={() => setOpen(false)}><p>Dialog contents</p></ModalDialog>}</>
    }
    document.body.setAttribute('style', 'color: red;')
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open details' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBe(document.activeElement)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.getAttribute('style')).toBe('color: red;')
    expect(trigger).toBe(document.activeElement)
  })

  it('closes through its backdrop only and restores the trigger and body style', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><button type="button" onClick={() => setOpen(true)}>Open details</button>{open && <ModalDialog title="Details" closeLabel="Close" onClose={() => setOpen(false)}><button type="button">More details</button></ModalDialog>}</>
    }
    document.body.setAttribute('style', 'background: white;')
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open details' })
    await user.click(trigger)
    await user.pointer({ target: screen.getByRole('button', { name: 'More details' }), keys: '[MouseLeft]' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.pointer({ target: document.querySelector('.modal-backdrop')!, keys: '[MouseLeft]' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.getAttribute('style')).toBe('background: white;')
    expect(trigger).toBe(document.activeElement)
  })

  it('traps Tab in both directions, including when focus has escaped to the background', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><button type="button">Background control</button><button type="button" onClick={() => setOpen(true)}>Open details</button>{open && <ModalDialog title="Details" closeLabel="Close" onClose={() => setOpen(false)}><button type="button">More details</button></ModalDialog>}</>
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open details' }))
    const close = screen.getByRole('button', { name: 'Close' })
    const more = screen.getByRole('button', { name: 'More details' })
    await user.tab({ shift: true })
    expect(more).toBe(document.activeElement)
    await user.tab()
    expect(close).toBe(document.activeElement)
    screen.getByRole('button', { name: 'Background control' }).focus()
    expect(dispatchTab().defaultPrevented).toBe(true)
    expect(close).toBe(document.activeElement)
    screen.getByRole('button', { name: 'Background control' }).focus()
    expect(dispatchTab(true).defaultPrevented).toBe(true)
    expect(more).toBe(document.activeElement)
  })

  it('contains a single-focusable dialog when focus escapes', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><button type="button">Background control</button><button type="button" onClick={() => setOpen(true)}>Open details</button>{open && <ModalDialog title="Details" closeLabel="Close" onClose={() => setOpen(false)}><p>Only close is focusable.</p></ModalDialog>}</>
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open details' }))
    const close = screen.getByRole('button', { name: 'Close' })
    screen.getByRole('button', { name: 'Background control' }).focus()
    dispatchTab()
    expect(close).toBe(document.activeElement)
    screen.getByRole('button', { name: 'Background control' }).focus()
    dispatchTab(true)
    expect(close).toBe(document.activeElement)
  })

  it('keeps the outer dialog locked while Escape closes only the topmost dialog', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [outerOpen, setOuterOpen] = useState(false)
      const [innerOpen, setInnerOpen] = useState(false)
      return <><button type="button" onClick={() => setOuterOpen(true)}>Open outer</button>{outerOpen && <ModalDialog title="Outer" closeLabel="Close outer" onClose={() => setOuterOpen(false)}><button type="button" onClick={() => setInnerOpen(true)}>Open inner</button>{innerOpen && <ModalDialog title="Inner" closeLabel="Close inner" onClose={() => setInnerOpen(false)}><p>Inner contents</p></ModalDialog>}</ModalDialog>}</>
    }
    document.body.setAttribute('style', 'color: navy;')
    render(<Harness />)
    const outerTrigger = screen.getByRole('button', { name: 'Open outer' })
    await user.click(outerTrigger)
    const innerTrigger = screen.getByRole('button', { name: 'Open inner' })
    await user.click(innerTrigger)
    expect(screen.getAllByRole('dialog')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Close inner' })).toBe(document.activeElement)
    innerTrigger.focus()
    expect(dispatchTab().defaultPrevented).toBe(true)
    expect(screen.getByRole('button', { name: 'Close inner' })).toBe(document.activeElement)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Inner' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Outer' })).toBeTruthy()
    expect(document.body.getAttribute('style')).toContain('overflow: hidden')
    expect(innerTrigger).toBe(document.activeElement)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.getAttribute('style')).toBe('color: navy;')
    expect(outerTrigger).toBe(document.activeElement)
  })

  it('does not churn modal lifecycle when the parent rerenders with a new close callback', async () => {
    const user = userEvent.setup()
    function Harness({ version }: { version: number }) {
      const [open, setOpen] = useState(false)
      return <><button type="button" onClick={() => setOpen(true)}>Open details</button><p>Version {version}</p>{open && <ModalDialog title="Details" closeLabel="Close" onClose={() => setOpen(false)}><button type="button">More details</button></ModalDialog>}</>
    }
    document.body.setAttribute('style', 'color: teal;')
    const view = render(<Harness version={0} />)
    await user.click(screen.getByRole('button', { name: 'Open details' }))
    const more = screen.getByRole('button', { name: 'More details' })
    more.focus()
    const lockedStyle = document.body.getAttribute('style')
    view.rerender(<Harness version={1} />)
    expect(more).toBe(document.activeElement)
    expect(document.body.getAttribute('style')).toBe(lockedStyle)
  })
})
