import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/payments')>()
  return { ...actual, getPayment: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPayment } from '@/lib/supabase/payments'
import { GET } from './route'

const fakeUser = { id: 'user-1', email: 'user@test.com', role: 'brand' as const, role_locked_at: '2026-04-01T00:00:00Z' }
const fakePayment = { id: 'pay-1', contract_id: 'contract-1', amount: 50000, status: 'pending' }

function makeRequest(contractId: string) {
  return new NextRequest(new URL(`/api/payments/${contractId}`, 'http://localhost'))
}

describe('GET /api/payments/[contractId]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeRequest('contract-1'), { params: Promise.resolve({ contractId: 'contract-1' }) })
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns the payment when found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getPayment).mockResolvedValue(fakePayment as never)
    const res = await GET(makeRequest('contract-1'), { params: Promise.resolve({ contractId: 'contract-1' }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(fakePayment)
  })

  it('returns null when no payment exists for the contract', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getPayment).mockResolvedValue(null)
    const res = await GET(makeRequest('contract-none'), { params: Promise.resolve({ contractId: 'contract-none' }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })
})
