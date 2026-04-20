import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/payments')>()
  return { ...actual, getSubscriptionForUser: vi.fn(), updateSubscription: vi.fn() }
})
vi.mock('@/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe')>()
  return { ...actual, cancelSubscription: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser, updateSubscription } from '@/lib/supabase/payments'
import { cancelSubscription } from '@/lib/stripe'
import { POST } from './route'
import { PaymentsError } from '@/lib/supabase/payments'

const brandUser = { id: 'user-brand', email: 'brand@test.com', role: 'brand' as const, role_locked_at: '2026-04-01T00:00:00Z' }
const activeSub = { id: 'sub-1', brand_id: 'brand-1', stripe_subscription_id: 'sub_stripe_abc', status: 'active', tier: 1 }

function makeRequest() {
  return new NextRequest(new URL('/api/payments/subscriptions/cancel', 'http://localhost'), { method: 'POST' })
}

describe('POST /api/payments/subscriptions/cancel', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createAdminClient).mockReturnValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 when user is not a brand', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...brandUser, role: 'athlete' as const } as never)
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('BRAND_ONLY')
  })

  it('returns 404 when brand has no subscription', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getSubscriptionForUser).mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_SUBSCRIPTION')
  })

  it('cancels subscription and returns success message', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getSubscriptionForUser).mockResolvedValue(activeSub as never)
    vi.mocked(cancelSubscription).mockResolvedValue(undefined)
    vi.mocked(updateSubscription).mockResolvedValue({ ...activeSub, cancellation_scheduled_at: '2026-04-20T00:00:00Z' } as never)
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toContain('cancel')
  })

  it('calls cancelSubscription with the stripe subscription id', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getSubscriptionForUser).mockResolvedValue(activeSub as never)
    vi.mocked(cancelSubscription).mockResolvedValue(undefined)
    vi.mocked(updateSubscription).mockResolvedValue(activeSub as never)
    await POST(makeRequest())
    expect(vi.mocked(cancelSubscription)).toHaveBeenCalledWith('sub_stripe_abc')
  })

  it('returns 422 when Stripe cancel fails', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getSubscriptionForUser).mockResolvedValue(activeSub as never)
    vi.mocked(cancelSubscription).mockRejectedValue(new Error('Stripe error'))
    const res = await POST(makeRequest())
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('CANCEL_FAILED')
  })
})
