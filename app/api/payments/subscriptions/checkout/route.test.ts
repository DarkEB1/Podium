import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/payments')>()
  return { ...actual, getSubscriptionForUser: vi.fn() }
})
vi.mock('@/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe')>()
  return { ...actual, createCheckoutSession: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { createCheckoutSession } from '@/lib/stripe'
import { POST } from './route'

const brandUser = { id: 'user-brand', email: 'brand@test.com', role: 'brand' as const, role_locked_at: '2026-04-01T00:00:00Z' }
const athleteUser = { id: 'user-athlete', email: 'athlete@test.com', role: 'athlete' as const, role_locked_at: '2026-04-01T00:00:00Z' }

function makePostRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/payments/subscriptions/checkout', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

describe('POST /api/payments/subscriptions/checkout', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    process.env['NEXT_PUBLIC_APP_URL'] = 'https://app.test'
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makePostRequest({ tier: 1 }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 when user is not a brand', async () => {
    vi.mocked(getUser).mockResolvedValue(athleteUser as never)
    const res = await POST(makePostRequest({ tier: 1 }))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('BRAND_ONLY')
  })

  it('returns 400 when tier is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when tier is invalid', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    const res = await POST(makePostRequest({ tier: 4 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_TIER')
  })

  it('returns checkout url and sessionId on success (no existing subscription)', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getSubscriptionForUser).mockResolvedValue(null)
    vi.mocked(createCheckoutSession).mockResolvedValue({ url: 'https://checkout.stripe.com/cs_abc', sessionId: 'cs_abc' })
    const res = await POST(makePostRequest({ tier: 1 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://checkout.stripe.com/cs_abc')
    expect(json.sessionId).toBe('cs_abc')
  })

  it('passes existing customerId when brand already has a subscription', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getSubscriptionForUser).mockResolvedValue({ stripe_customer_id: 'cus_existing' } as never)
    vi.mocked(createCheckoutSession).mockResolvedValue({ url: 'https://checkout.stripe.com/cs_new', sessionId: 'cs_new' })
    await POST(makePostRequest({ tier: 2 }))
    expect(vi.mocked(createCheckoutSession)).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_existing', tier: 2 })
    )
  })
})
