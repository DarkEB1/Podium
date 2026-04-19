import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/deals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/deals')>()
  return { ...actual, getContract: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getContract, DealsError } from '@/lib/supabase/deals'
import { GET } from './route'

const fakeUser = { id: 'user-1', email: 'test@example.com', role: 'brand' as const, role_locked_at: '2026-04-19T00:00:00Z' }
const params = Promise.resolve({ proposalId: 'p1' })

function makeGetRequest() {
  return new NextRequest(new URL('/api/deals/proposals/p1/contract', 'http://localhost'), { method: 'GET' })
}

describe('GET /api/deals/proposals/[proposalId]/contract', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(401)
  })

  it('returns 200 with contract on success', async () => {
    const fakeContract = { id: 'c1', proposal_id: 'p1', status: 'draft' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getContract).mockResolvedValue(fakeContract as never)
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeContract)
  })

  it('returns 404 when no contract exists for the proposal', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getContract).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('CONTRACT_NOT_FOUND')
  })

  it('calls getContract with proposalId', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getContract).mockResolvedValue(null)
    await GET(makeGetRequest(), { params })
    expect(getContract).toHaveBeenCalledWith(expect.anything(), 'p1')
  })

  it('returns 500 on CONTRACT_FETCH_FAILED', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getContract).mockRejectedValue(new DealsError('CONTRACT_FETCH_FAILED', 'DB error'))
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error.code).toBe('CONTRACT_FETCH_FAILED')
  })
})
