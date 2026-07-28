import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendGuardianConsentRequestEmail, sendGuardianDealNoticeEmail } from './guardian'
import * as provider from './provider'

vi.mock('./provider', () => ({
  sendViaProvider: vi.fn(),
}))

const mockedSend = vi.mocked(provider.sendViaProvider)

beforeEach(() => {
  mockedSend.mockReset()
  mockedSend.mockResolvedValue({ ok: true, providerId: 'prov-1' })
})

describe('sendGuardianConsentRequestEmail', () => {
  it('sends to the guardian with a consent link and the athlete name', async () => {
    const result = await sendGuardianConsentRequestEmail({
      to: 'guardian@example.com',
      guardianName: 'Jane Guardian',
      athleteName: 'Sam Athlete',
      consentUrl: 'https://podium.app/guardian/consent/abc123',
    })

    expect(result.ok).toBe(true)
    expect(mockedSend).toHaveBeenCalledTimes(1)
    const sent = mockedSend.mock.calls[0]![0]
    expect(sent.to).toBe('guardian@example.com')
    expect(sent.subject).toContain('Sam Athlete')
    expect(sent.html).toContain('https://podium.app/guardian/consent/abc123')
    expect(sent.text).toContain('https://podium.app/guardian/consent/abc123')
    expect(sent.html).toContain('Jane Guardian')
  })

  it('falls back to a neutral greeting when no guardian name is known', async () => {
    await sendGuardianConsentRequestEmail({
      to: 'g@example.com',
      guardianName: null,
      athleteName: 'Sam',
      consentUrl: 'https://podium.app/x',
    })
    const sent = mockedSend.mock.calls[0]![0]
    expect(sent.text).toContain('Hello there,')
  })

  it('escapes athlete-supplied content in the HTML body', async () => {
    await sendGuardianConsentRequestEmail({
      to: 'g@example.com',
      guardianName: null,
      athleteName: '<script>alert(1)</script>',
      consentUrl: 'https://podium.app/x',
    })
    const sent = mockedSend.mock.calls[0]![0]
    expect(sent.html).not.toContain('<script>alert(1)</script>')
    expect(sent.html).toContain('&lt;script&gt;')
  })

  it('reports a skipped transport (no provider key) without throwing', async () => {
    mockedSend.mockResolvedValue({ ok: false, skipped: true, error: 'RESEND_API_KEY not configured' })
    const result = await sendGuardianConsentRequestEmail({
      to: 'g@example.com',
      guardianName: null,
      athleteName: 'Sam',
      consentUrl: 'https://podium.app/x',
    })
    expect(result).toMatchObject({ ok: false, skipped: true })
  })

  it('never throws when the transport rejects', async () => {
    mockedSend.mockRejectedValue(new Error('network boom'))
    const result = await sendGuardianConsentRequestEmail({
      to: 'g@example.com',
      guardianName: null,
      athleteName: 'Sam',
      consentUrl: 'https://podium.app/x',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('network boom')
  })

  it('contains no em dash in either body', async () => {
    await sendGuardianConsentRequestEmail({
      to: 'g@example.com',
      guardianName: 'Jane',
      athleteName: 'Sam',
      consentUrl: 'https://podium.app/x',
    })
    const sent = mockedSend.mock.calls[0]![0]
    expect(sent.html).not.toContain('—')
    expect(sent.text).not.toContain('—')
  })
})

describe('sendGuardianDealNoticeEmail', () => {
  it('sends the deal details as an informational notice', async () => {
    const result = await sendGuardianDealNoticeEmail({
      to: 'guardian@example.com',
      guardianName: 'Jane',
      athleteName: 'Sam',
      brandName: 'Acme Sports',
      dealTitle: 'Summer Campaign',
      amountFormatted: '£5,000',
    })
    expect(result.ok).toBe(true)
    const sent = mockedSend.mock.calls[0]![0]
    expect(sent.subject).toContain('Sam')
    expect(sent.html).toContain('Acme Sports')
    expect(sent.html).toContain('Summer Campaign')
    expect(sent.html).toContain('£5,000')
    expect(sent.text).toContain('Brand: Acme Sports')
  })
})
