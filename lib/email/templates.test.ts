import { describe, it, expect } from 'vitest'
import { renderEmail } from './templates'
import { EMAIL_EVENTS, type EmailEvent, type TemplateData } from './types'

// ---------------------------------------------------------------------------
// Fixtures: valid data for every catalogue event.
// ---------------------------------------------------------------------------

const DEEP_LINK = 'https://app.podium.test/go/123'
const PREFS_URL = 'https://app.podium.test/settings/notifications'
const footer = { preferencesUrl: PREFS_URL }

const data: { [E in EmailEvent]: TemplateData[E] } = {
  connection_request_received: {
    recipientName: 'Maya',
    senderName: 'Northwind',
    message: 'Would love to work together',
    url: DEEP_LINK,
  },
  connection_request_accepted: {
    recipientName: 'Maya',
    otherName: 'Northwind',
    url: DEEP_LINK,
  },
  proposal_received: {
    recipientName: 'Maya',
    senderName: 'Northwind',
    proposalTitle: 'Summer campaign',
    url: DEEP_LINK,
  },
  proposal_accepted: {
    recipientName: 'Maya',
    proposalTitle: 'Summer campaign',
    url: DEEP_LINK,
  },
  contract_fully_signed: {
    recipientName: 'Maya',
    counterpartyName: 'Northwind',
    url: DEEP_LINK,
  },
  payment_received: {
    recipientName: 'Maya',
    amountFormatted: '£1,200.00',
    fromName: 'Northwind',
    url: DEEP_LINK,
  },
  subscription_started: {
    recipientName: 'Maya',
    tierName: 'Pro',
    url: DEEP_LINK,
  },
  subscription_payment_failed: {
    recipientName: 'Maya',
    url: DEEP_LINK,
  },
}

const ALL_EVENTS = Object.keys(EMAIL_EVENTS) as EmailEvent[]

// ---------------------------------------------------------------------------
// Every event renders a complete email.
// ---------------------------------------------------------------------------

describe('renderEmail — completeness for every catalogue event', () => {
  it.each(ALL_EVENTS)('%s returns non-empty subject/html/text', (event) => {
    const out = renderEmail(event, data[event], footer)

    expect(out.subject.trim().length).toBeGreaterThan(0)
    expect(out.html.trim().length).toBeGreaterThan(0)
    expect(out.text.trim().length).toBeGreaterThan(0)
    // The shell always renders.
    expect(out.html).toContain('<!doctype html>')
  })

  it.each(ALL_EVENTS)('%s html + text carry the deep-link and the preferences URL', (event) => {
    const out = renderEmail(event, data[event], footer)

    // Deep-link (the CTA button target).
    expect(out.html).toContain(DEEP_LINK)
    expect(out.text).toContain(DEEP_LINK)
    // Mandatory CL-4 preferences link.
    expect(out.html).toContain(PREFS_URL)
    expect(out.text).toContain(PREFS_URL)
  })
})

// ---------------------------------------------------------------------------
// SECURITY (B-8 / SEC-1): user-supplied fields must be escaped in HTML.
// ---------------------------------------------------------------------------

const XSS = '"><img src=x onerror=alert(1)>'

describe('renderEmail — user content is escaped in HTML (B-8/SEC-1)', () => {
  it('connection_request_received escapes a malicious message and senderName', () => {
    const out = renderEmail(
      'connection_request_received',
      { recipientName: 'Maya', senderName: XSS, message: XSS, url: DEEP_LINK },
      footer
    )
    expect(out.html).not.toMatch(/<img/i)
    expect(out.html).toContain('&lt;img')
  })

  it('proposal_received escapes a malicious proposalTitle and senderName', () => {
    const out = renderEmail(
      'proposal_received',
      { recipientName: 'Maya', senderName: XSS, proposalTitle: XSS, url: DEEP_LINK },
      footer
    )
    expect(out.html).not.toMatch(/<img/i)
    expect(out.html).toContain('&lt;img')
  })

  it('payment_received escapes a malicious fromName', () => {
    const out = renderEmail(
      'payment_received',
      { recipientName: 'Maya', amountFormatted: '£10.00', fromName: XSS, url: DEEP_LINK },
      footer
    )
    expect(out.html).not.toMatch(/<img/i)
    expect(out.html).toContain('&lt;img')
  })

  it('a javascript: deep-link is neutralised to # in the CTA button', () => {
    const out = renderEmail(
      'proposal_received',
      {
        recipientName: 'Maya',
        senderName: 'Northwind',
        proposalTitle: 'Deal',
        // eslint-disable-next-line no-script-url
        url: 'javascript:alert(1)',
      },
      footer
    )
    expect(out.html).not.toContain('javascript:')
    expect(out.html).toContain('href="#"')
  })
})

// ---------------------------------------------------------------------------
// Subjects reflect the event. Subjects are plain text (not HTML), so the
// template interpolates the raw value — there is no `html` escaping applied.
// ---------------------------------------------------------------------------

describe('renderEmail — subject reflects the event', () => {
  it('proposal_received subject contains the (raw, unescaped) proposal title', () => {
    const out = renderEmail('proposal_received', data.proposal_received, footer)
    expect(out.subject).toBe('New proposal: Summer campaign')
    expect(out.subject).toContain('Summer campaign')
  })

  it('payment_received subject contains the amount', () => {
    const out = renderEmail('payment_received', data.payment_received, footer)
    expect(out.subject).toContain('£1,200.00')
  })

  it('subject is plain text and is not HTML-escaped (documents current behaviour)', () => {
    // A subject line is rendered by the mail client as text, not markup, so the
    // template does NOT run it through the `html` escaper. This asserts that
    // documented choice: a special char in a title lands verbatim in the subject.
    const out = renderEmail(
      'proposal_received',
      { recipientName: 'Maya', senderName: 'X', proposalTitle: 'A & B', url: DEEP_LINK },
      footer
    )
    expect(out.subject).toBe('New proposal: A & B')
  })
})
