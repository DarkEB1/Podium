import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/deals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/deals')>()
  return { ...actual, respondToProposal: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { respondToProposal, DealsError } from '@/lib/supabase/deals'
import { POST } from './route'

const fakeUser = { id: 'user-1', email: 'test@example.com', role: 'athlete' as const, role_locked_at: '2026-04-19T00:00:00Z' }
const params = Promise.resolve({ proposalId: 'p1' })

function makePostRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/deals/proposals/p1/respond', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('POST /api/deals/proposals/[proposalId]/respond', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.mocked(createAdminClient).mockReturnValue({} as unknown as ReturnType<typeof createAdminClient>)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makePostRequest({ action: 'accepted' }), { params })
    expect(res.status).toBe(401)
  })

  it('returns 400 when action is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({}), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_ACTION')
  })

  it('returns 400 when action is invalid', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ action: 'countered' }), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_ACTION')
  })

  it('returns 200 with proposal on accept success', async () => {
    const fakeProposal = { id: 'p1', status: 'accepted' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(respondToProposal).mockResolvedValue(fakeProposal as never)
    const res = await POST(makePostRequest({ action: 'accepted' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeProposal)
  })

  it('returns 404 when proposal not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(respondToProposal).mockRejectedValue(new DealsError('PROPOSAL_NOT_FOUND', 'Not found'))
    const res = await POST(makePostRequest({ action: 'declined' }), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROPOSAL_NOT_FOUND')
  })

  it('returns 409 when proposal is not pending', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(respondToProposal).mockRejectedValue(new DealsError('PROPOSAL_NOT_PENDING', 'Not pending'))
    const res = await POST(makePostRequest({ action: 'accepted' }), { params })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('PROPOSAL_NOT_PENDING')
  })

  it('returns 403 when caller is the sender', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(respondToProposal).mockRejectedValue(new DealsError('NOT_RECIPIENT', 'Sender cannot respond'))
    const res = await POST(makePostRequest({ action: 'accepted' }), { params })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_RECIPIENT')
  })

  it('returns 500 when contract creation fails', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(respondToProposal).mockRejectedValue(new DealsError('CONTRACT_CREATE_FAILED', 'insert failed'))
    const res = await POST(makePostRequest({ action: 'accepted' }), { params })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error.code).toBe('CONTRACT_CREATE_FAILED')
  })
})
