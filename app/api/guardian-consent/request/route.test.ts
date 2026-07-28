import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { writeByUser: { limit: 60, windowSeconds: 60 } },
  consume: vi.fn(),
  tooManyRequests: () => new Response(null, { status: 429 }),
  userKey: (a: string, b: string) => `${a}:${b}`,
}))
vi.mock('@/lib/supabase/guardian', () => ({
  requestGuardianConsent: vi.fn(),
  GuardianConsentError: class GuardianConsentError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
      this.name = 'GuardianConsentError'
    }
  },
}))
vi.mock('@/lib/email/guardian', () => ({ sendGuardianConsentRequestEmail: vi.fn() }))
vi.mock('@/lib/email/notify', () => ({ absoluteUrl: (p: string) => `https://podium.app${p}` }))

import { POST } from './route'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { consume } from '@/lib/rate-limit'
import { requestGuardianConsent, GuardianConsentError } from '@/lib/supabase/guardian'
import { sendGuardianConsentRequestEmail } from '@/lib/email/guardian'

beforeEach(() => {
  vi.mocked(createClient).mockResolvedValue({} as never)
  vi.mocked(createAdminClient).mockReturnValue({} as never)
  vi.mocked(consume).mockResolvedValue({ allowed: true } as never)
  vi.mocked(sendGuardianConsentRequestEmail).mockResolvedValue({ ok: true })
})

const req = () => new NextRequest('http://localhost/api/guardian-consent/request', { method: 'POST' })
const athlete = { id: 'ath-1', role: 'athlete', email: 'a@example.com' }

describe('POST /api/guardian-consent/request', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('429 when rate limited', async () => {
    vi.mocked(getUser).mockResolvedValue(athlete as never)
    vi.mocked(consume).mockResolvedValue({ allowed: false, retryAfter: 30 } as never)
    const res = await POST(req())
    expect(res.status).toBe(429)
  })

  it('emails the guardian and returns sent on success', async () => {
    vi.mocked(getUser).mockResolvedValue(athlete as never)
    vi.mocked(requestGuardianConsent).mockResolvedValue({
      rawToken: 'tok-123',
      guardianEmail: 'guardian@example.com',
      guardianName: 'Jane',
      athleteName: 'Sam',
      expiresAt: '2026-08-01T00:00:00Z',
    })

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'sent' })
    expect(sendGuardianConsentRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guardian@example.com',
        consentUrl: 'https://podium.app/guardian/consent/tok-123',
      })
    )
  })

  it('maps ALREADY_CONSENTED to 409', async () => {
    vi.mocked(getUser).mockResolvedValue(athlete as never)
    vi.mocked(requestGuardianConsent).mockRejectedValue(
      new GuardianConsentError('ALREADY_CONSENTED', 'already')
    )
    const res = await POST(req())
    expect(res.status).toBe(409)
  })

  it('maps NOT_UNDER_18 to 400', async () => {
    vi.mocked(getUser).mockResolvedValue(athlete as never)
    vi.mocked(requestGuardianConsent).mockRejectedValue(
      new GuardianConsentError('NOT_UNDER_18', 'not minor')
    )
    const res = await POST(req())
    expect(res.status).toBe(400)
  })

  it('does not return the token to the caller', async () => {
    vi.mocked(getUser).mockResolvedValue(athlete as never)
    vi.mocked(requestGuardianConsent).mockResolvedValue({
      rawToken: 'secret-token',
      guardianEmail: 'guardian@example.com',
      guardianName: null,
      athleteName: 'Sam',
      expiresAt: '2026-08-01T00:00:00Z',
    })
    const res = await POST(req())
    expect(JSON.stringify(await res.json())).not.toContain('secret-token')
  })
})
