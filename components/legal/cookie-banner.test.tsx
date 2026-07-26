import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import CookieBanner from './cookie-banner'
import { resetCookieConsentStore } from './cookie-consent-store'
import {
  clearConsentCookie,
  readConsentCookie,
  writeConsentCookie,
  acceptAllPreferences,
} from '@/lib/legal/cookie-consent'

// jsdom lacks PointerEvent / pointer-capture, which Base UI's Switch relies on.
// Provide minimal shims so switch clicks dispatch in tests.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  ;(globalThis as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {} as unknown
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

const saveCookiePrefsForCurrentUser = vi.fn().mockResolvedValue(false)

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}))

vi.mock('@/lib/supabase/settings', () => ({
  saveCookiePrefsForCurrentUser: (...args: unknown[]) =>
    saveCookiePrefsForCurrentUser(...args),
}))

describe('CookieBanner (M-7 / CL-2)', () => {
  beforeEach(() => {
    clearConsentCookie()
    resetCookieConsentStore()
    saveCookiePrefsForCurrentUser.mockClear()
  })

  afterEach(() => {
    clearConsentCookie()
    resetCookieConsentStore()
  })

  it('appears when no choice has been recorded', async () => {
    render(<CookieBanner />)
    expect(await screen.findByTestId('cookie-banner')).toBeInTheDocument()
  })

  it('offers accept, reject and manage with reject as prominent as accept', async () => {
    render(<CookieBanner />)
    await screen.findByTestId('cookie-banner')

    const accept = screen.getByRole('button', { name: /accept all/i })
    const reject = screen.getByRole('button', { name: /reject non-essential/i })
    expect(accept).toBeInTheDocument()
    expect(reject).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /manage preferences/i })).toBeInTheDocument()

    // Both are real buttons, one click each — rejecting is never harder.
    expect(reject.tagName).toBe(accept.tagName)
  })

  it('stays hidden once a current choice exists', async () => {
    writeConsentCookie(acceptAllPreferences())
    render(<CookieBanner />)

    await waitFor(() => {
      expect(screen.queryByTestId('cookie-banner')).not.toBeInTheDocument()
    })
  })

  it('records a full opt-in when Accept all is pressed', async () => {
    const user = userEvent.setup()
    render(<CookieBanner />)
    await screen.findByTestId('cookie-banner')

    await user.click(screen.getByRole('button', { name: /accept all/i }))

    await waitFor(() => {
      const stored = readConsentCookie()
      expect(stored?.analytics).toBe(true)
      expect(stored?.marketing).toBe(true)
    })
    expect(screen.queryByTestId('cookie-banner')).not.toBeInTheDocument()
  })

  it('records a rejection that leaves every non-essential category off', async () => {
    const user = userEvent.setup()
    render(<CookieBanner />)
    await screen.findByTestId('cookie-banner')

    await user.click(screen.getByRole('button', { name: /reject non-essential/i }))

    await waitFor(() => {
      const stored = readConsentCookie()
      expect(stored?.necessary).toBe(true)
      expect(stored?.analytics).toBe(false)
      expect(stored?.marketing).toBe(false)
    })
  })

  it('opens granular preferences with nothing pre-ticked', async () => {
    const user = userEvent.setup()
    render(<CookieBanner />)
    await screen.findByTestId('cookie-banner')

    await user.click(screen.getByRole('button', { name: /manage preferences/i }))

    const analytics = await screen.findByRole('switch', { name: /analytics/i })
    const marketing = screen.getByRole('switch', { name: /marketing/i })
    const necessary = screen.getByRole('switch', { name: /strictly necessary/i })

    expect(analytics).toHaveAttribute('aria-checked', 'false')
    expect(marketing).toHaveAttribute('aria-checked', 'false')
    expect(necessary).toHaveAttribute('aria-checked', 'true')
    // Base UI renders the switch as a <span role="switch">, so the locked
    // state surfaces as aria-disabled rather than the disabled attribute.
    expect(necessary).toHaveAttribute('aria-disabled', 'true')
  })

  it('saves a granular choice', async () => {
    const user = userEvent.setup()
    render(<CookieBanner />)
    await screen.findByTestId('cookie-banner')

    await user.click(screen.getByRole('button', { name: /manage preferences/i }))
    await user.click(await screen.findByRole('switch', { name: /analytics/i }))
    await user.click(screen.getByRole('button', { name: /save my choices/i }))

    await waitFor(() => {
      const stored = readConsentCookie()
      expect(stored?.analytics).toBe(true)
      expect(stored?.marketing).toBe(false)
    })
  })

  it('mirrors the choice to the signed-in user account', async () => {
    const user = userEvent.setup()
    render(<CookieBanner />)
    await screen.findByTestId('cookie-banner')

    await user.click(screen.getByRole('button', { name: /accept all/i }))

    await waitFor(() => {
      expect(saveCookiePrefsForCurrentUser).toHaveBeenCalledTimes(1)
    })
  })
})
