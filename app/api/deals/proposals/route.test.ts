import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/deals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/deals')>()
  return { ...actual, getProposals: vi.fn(), sendProposal: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getProposals, sendProposal, DealsError } from '@/lib/supabase/deals'
import { GET, POST } from './route'

const fakeUser = { id: 'user-1', email: 'test@example.com', role: 'brand' as const, role_locked_at: '2026-04-19T00:00:00Z' }

function makeGetRequest(matchId?: string) {
  const url = matchId
    ? new URL(`/api/deals/proposals?matchId=${matchId}`, 'http://localhost')
    : new URL('/api/deals/proposals', 'http://localhost')
  return new NextRequest(url, { method: 'GET' })
}

function makePostRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/deals/proposals', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('GET /api/deals/proposals', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest('m1'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when matchId is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 200 with proposals array on success', async () => {
    const fakeProposals = [{ id: 'p1', match_id: 'm1', status: 'pending' }]
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getProposals).mockResolvedValue(fakeProposals as never)
    const res = await GET(makeGetRequest('m1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeProposals)
  })

  it('returns 404 when match not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getProposals).mockRejectedValue(new DealsError('MATCH_NOT_FOUND', 'Not found'))
    const res = await GET(makeGetRequest('m1'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('MATCH_NOT_FOUND')
  })
})

describe('POST /api/deals/proposals', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makePostRequest({ match_id: 'm1', title: 'Test', pay_amount: 100, pay_type: 'flat_fee' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ match_id: 'm1' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when pay_type is invalid', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ match_id: 'm1', title: 'Test', pay_amount: 100, pay_type: 'invalid' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PAY_TYPE')
  })

  it('returns 400 when pay_amount is not a positive number', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ match_id: 'm1', title: 'Test', pay_amount: -100, pay_type: 'flat_fee' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PAY_AMOUNT')
  })

  it('returns 201 with proposal on success', async () => {
    const fakeProposal = { id: 'p1', match_id: 'm1', title: 'Summer Campaign', status: 'pending' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendProposal).mockResolvedValue(fakeProposal as never)
    const res = await POST(makePostRequest({ match_id: 'm1', title: 'Summer Campaign', pay_amount: 5000, pay_type: 'flat_fee' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeProposal)
  })

  it('calls sendProposal with matchId and userId', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendProposal).mockResolvedValue({} as never)
    await POST(makePostRequest({ match_id: 'm1', title: 'Test', pay_amount: 500, pay_type: 'flat_fee' }))
    expect(sendProposal).toHaveBeenCalledWith(
      expect.anything(),
      'm1',
      'user-1',
      expect.objectContaining({ title: 'Test', pay_amount: 500, pay_type: 'flat_fee' })
    )
  })
})
