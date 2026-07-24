import { describe, it, expect } from 'vitest'
import { renderLayout, button, renderText } from './render'

const PREFS_URL = 'https://app.podium.test/settings/notifications'
// Path-based (no query string) so the URL survives HTML-attribute escaping
// verbatim; the escaping of query params is covered elsewhere.
const UNSUB_URL = 'https://app.podium.test/api/unsubscribe/abctoken'

// ---------------------------------------------------------------------------
// renderLayout — the mandatory CL-4 footer.
// ---------------------------------------------------------------------------

describe('renderLayout', () => {
  it('always includes the preferences URL (CL-4 footer is mandatory)', () => {
    const html = renderLayout({
      preheader: 'hi',
      bodyHtml: '<p>body</p>',
      preferencesUrl: PREFS_URL,
    })
    expect(html).toContain(PREFS_URL)
    expect(html).toContain('Manage email preferences')
  })

  it('includes an Unsubscribe link only when unsubscribeUrl is provided', () => {
    const withUnsub = renderLayout({
      preheader: 'hi',
      bodyHtml: '<p>body</p>',
      preferencesUrl: PREFS_URL,
      unsubscribeUrl: UNSUB_URL,
    })
    expect(withUnsub).toContain('>Unsubscribe<')
    expect(withUnsub).toContain(UNSUB_URL)
    // Preferences link is still present alongside.
    expect(withUnsub).toContain('Manage email preferences')
  })

  it('omits the Unsubscribe link when unsubscribeUrl is absent, but keeps preferences', () => {
    const noUnsub = renderLayout({
      preheader: 'hi',
      bodyHtml: '<p>body</p>',
      preferencesUrl: PREFS_URL,
    })
    expect(noUnsub).not.toContain('>Unsubscribe<')
    expect(noUnsub).toContain('Manage email preferences')
  })

  it('escapes HTML in the hidden preheader span', () => {
    const html = renderLayout({
      preheader: '<b>evil</b>',
      bodyHtml: '<p>body</p>',
      preferencesUrl: PREFS_URL,
    })
    expect(html).not.toContain('<b>evil</b>')
    expect(html).toContain('&lt;b&gt;evil&lt;/b&gt;')
  })

  it('inserts bodyHtml as trusted markup (it is the template’s own escaped output)', () => {
    const html = renderLayout({
      preheader: 'hi',
      bodyHtml: '<p id="marker">hello</p>',
      preferencesUrl: PREFS_URL,
    })
    expect(html).toContain('<p id="marker">hello</p>')
  })
})

// ---------------------------------------------------------------------------
// button — escapes label and URL.
// ---------------------------------------------------------------------------

describe('button', () => {
  it('neutralises a javascript: URL to # via safeUrl', () => {
    // eslint-disable-next-line no-script-url
    const out = button('Click me', 'javascript:alert(1)')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('href="#"')
  })

  it('escapes the label', () => {
    const out = button('<img src=x onerror=alert(1)>', 'https://podium.test/x')
    expect(out).not.toMatch(/<img/i)
    expect(out).toContain('&lt;img')
  })

  it('keeps a safe https URL', () => {
    const out = button('Go', 'https://podium.test/x')
    expect(out).toContain('https://podium.test/x')
  })
})

// ---------------------------------------------------------------------------
// renderText — the plain-text footer.
// ---------------------------------------------------------------------------

describe('renderText', () => {
  it('always appends the preferences line', () => {
    const text = renderText(['Line one'], { preferencesUrl: PREFS_URL })
    expect(text).toContain('Line one')
    expect(text).toContain(`Manage email preferences: ${PREFS_URL}`)
  })

  it('appends the unsubscribe line only when an unsubscribe URL is given', () => {
    const withUnsub = renderText(['Line'], {
      preferencesUrl: PREFS_URL,
      unsubscribeUrl: UNSUB_URL,
    })
    expect(withUnsub).toContain(`Unsubscribe: ${UNSUB_URL}`)

    const noUnsub = renderText(['Line'], { preferencesUrl: PREFS_URL })
    expect(noUnsub).not.toContain('Unsubscribe:')
  })
})
