import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/payments')>()
  return { ...actual, getPaymentHistory: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPaymentHistory } from '@/lib/supabase/payments'
import { GET } from './route'

const fakeUser = { id: 'user-1', email: 'user@test.com', role: 'brand' as const, role_locked_at: '2026-04-01T00:00:00Z' }
const fakePayments = [{ id: 'pay-1', amount: 50000, status: 'succeeded' }]

function makeRequest() {
  return new NextRequest(new URL('/api/payments/history', 'http://localhost'))
}

describe('GET /api/payments/history', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns payment history array on success', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getPaymentHistory).mockResolvedValue(fakePayments as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(fakePayments)
  })

  it('returns empty array when no payments exist', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getPaymentHistory).mockResolvedValue([])
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
