import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/payments')>()
  return {
    ...actual,
    getContractForPayment: vi.fn(),
    getSubscriptionForUser: vi.fn(),
    createPaymentRecord: vi.fn(),
  }
})
vi.mock('@/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe')>()
  return { ...actual, createPaymentIntent: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getContractForPayment, getSubscriptionForUser, createPaymentRecord } from '@/lib/supabase/payments'
import { createPaymentIntent } from '@/lib/stripe'
import { POST } from './route'
import { PaymentsError } from '@/lib/supabase/payments'

const brandUser = { id: 'user-brand', email: 'brand@test.com', role: 'brand' as const, role_locked_at: '2026-04-01T00:00:00Z' }
const fakeContract = { id: 'contract-1', brand_id: 'user-brand', athlete_or_team_id: 'user-athlete', pay_amount: 50000, pay_currency: 'GBP' }
const fakeSub = { stripe_customer_id: 'cus_brand' }
const fakePayment = { id: 'pay-1', stripe_payment_intent_id: 'pi_abc' }

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/payments/intents', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

describe('POST /api/payments/intents', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createAdminClient).mockReturnValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ contractId: 'c-1' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 when user is not a brand', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...brandUser, role: 'athlete' as const } as never)
    const res = await POST(makeRequest({ contractId: 'c-1' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('BRAND_ONLY')
  })

  it('returns 400 when contractId is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_FIELDS')
  })

  it('returns 404 when contract not found', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getContractForPayment).mockRejectedValue(new PaymentsError('CONTRACT_NOT_FOUND', 'not found'))
    const res = await POST(makeRequest({ contractId: 'bad-contract' }))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('CONTRACT_NOT_FOUND')
  })

  it('returns 403 when brand is not the payer for this contract', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getContractForPayment).mockResolvedValue({ ...fakeContract, brand_id: 'different-brand' })
    const res = await POST(makeRequest({ contractId: 'contract-1' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('NOT_CONTRACT_BRAND')
  })

  it('returns 404 when brand has no subscription (no stripe customer)', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getContractForPayment).mockResolvedValue(fakeContract)
    vi.mocked(getSubscriptionForUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ contractId: 'contract-1' }))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_SUBSCRIPTION')
  })

  it('returns clientSecret, paymentIntentId, and paymentId on success', async () => {
    vi.mocked(getUser).mockResolvedValue(brandUser as never)
    vi.mocked(getContractForPayment).mockResolvedValue(fakeContract)
    vi.mocked(getSubscriptionForUser).mockResolvedValue(fakeSub as never)
    vi.mocked(createPaymentIntent).mockResolvedValue({ clientSecret: 'pi_secret', paymentIntentId: 'pi_abc' })
    vi.mocked(createPaymentRecord).mockResolvedValue(fakePayment as never)
    const res = await POST(makeRequest({ contractId: 'contract-1' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.clientSecret).toBe('pi_secret')
    expect(json.paymentIntentId).toBe('pi_abc')
    expect(json.paymentId).toBe('pay-1')
  })
})
