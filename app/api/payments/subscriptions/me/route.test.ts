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

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { GET } from './route'

const fakeUser = { id: 'user-1', email: 'brand@test.com', role: 'brand' as const, role_locked_at: '2026-04-01T00:00:00Z' }
const fakeSub = { id: 'sub-1', brand_id: 'brand-1', tier: 1, status: 'active' }

function makeRequest() {
  return new NextRequest(new URL('/api/payments/subscriptions/me', 'http://localhost'))
}

describe('GET /api/payments/subscriptions/me', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns subscription when found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getSubscriptionForUser).mockResolvedValue(fakeSub as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(fakeSub)
  })

  it('returns null when no subscription exists', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getSubscriptionForUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })
})
