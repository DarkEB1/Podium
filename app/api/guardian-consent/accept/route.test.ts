import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { guardianConsentByIp: { limit: 30, windowSeconds: 3600 } },
  consume: vi.fn(),
  tooManyRequests: () => new Response(null, { status: 429 }),
  ipKey: (a: string, b: string) => `${a}:${b}`,
  clientIpFrom: () => '1.2.3.4',
}))
vi.mock('@/lib/supabase/guardian', () => ({
  acceptGuardianConsent: vi.fn(),
  GuardianConsentError: class GuardianConsentError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
      this.name = 'GuardianConsentError'
    }
  },
}))

import { POST } from './route'
import { createAdminClient } from '@/lib/supabase/server'
import { consume } from '@/lib/rate-limit'
import { acceptGuardianConsent, GuardianConsentError } from '@/lib/supabase/guardian'

beforeEach(() => {
  vi.mocked(createAdminClient).mockReturnValue({} as never)
  vi.mocked(consume).mockResolvedValue({ allowed: true } as never)
})

function req(body: unknown) {
  return new NextRequest('http://localhost/api/guardian-consent/accept', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/guardian-consent/accept', () => {
  it('429 when rate limited', async () => {
    vi.mocked(consume).mockResolvedValue({ allowed: false, retryAfter: 60 } as never)
    const res = await POST(req({ token: 'x' }))
    expect(res.status).toBe(429)
  })

  it('400 when the token is missing', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_TOKEN')
  })

  it('records consent and returns accepted', async () => {
    vi.mocked(acceptGuardianConsent).mockResolvedValue({ athleteUserId: 'ath-1', athleteName: 'Sam' })
    const res = await POST(req({ token: 'good' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'accepted', athleteName: 'Sam' })
    expect(acceptGuardianConsent).toHaveBeenCalledWith(expect.anything(), 'good')
  })

  it('maps TOKEN_EXPIRED to 410', async () => {
    vi.mocked(acceptGuardianConsent).mockRejectedValue(
      new GuardianConsentError('TOKEN_EXPIRED', 'expired')
    )
    const res = await POST(req({ token: 'old' }))
    expect(res.status).toBe(410)
  })

  it('maps TOKEN_INVALID to 404', async () => {
    vi.mocked(acceptGuardianConsent).mockRejectedValue(
      new GuardianConsentError('TOKEN_INVALID', 'nope')
    )
    const res = await POST(req({ token: 'bad' }))
    expect(res.status).toBe(404)
  })
})
