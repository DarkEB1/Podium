import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/deals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/deals')>()
  return { ...actual, counterProposal: vi.fn() }
})
vi.mock('@/lib/supabase/messaging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/messaging')>()
  return { ...actual, getMatches: vi.fn() }
})
vi.mock('@/lib/email', () => ({ sendTransactionalEmail: vi.fn() }))
vi.mock('@/lib/email/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/notify')>()
  return { ...actual, resolveDisplayNames: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { counterProposal, DealsError } from '@/lib/supabase/deals'
import { getMatches } from '@/lib/supabase/messaging'
import { sendTransactionalEmail } from '@/lib/email'
import { resolveDisplayNames } from '@/lib/email/notify'
import { POST } from './route'

const fakeUser = { id: 'user-1', email: 'test@example.com', role: 'athlete' as const, role_locked_at: '2026-04-19T00:00:00Z' }
const params = Promise.resolve({ proposalId: 'p1' })

function makePostRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/deals/proposals/p1/counter', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('POST /api/deals/proposals/[proposalId]/counter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.mocked(createAdminClient).mockReturnValue({} as unknown as ReturnType<typeof createAdminClient>)
    vi.mocked(getMatches).mockResolvedValue([])
    vi.mocked(resolveDisplayNames).mockResolvedValue({})
    vi.mocked(sendTransactionalEmail).mockResolvedValue({ status: 'sent', deliveryId: 'd1', providerId: 'p1' })
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makePostRequest({ title: 'Counter', pay_amount: 200, pay_type: 'flat_fee' }), { params })
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ title: 'Counter' }), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when pay_type is invalid', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ title: 'Counter', pay_amount: 200, pay_type: 'bad_type' }), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PAY_TYPE')
  })

  it('returns 201 with counter proposal on success', async () => {
    const fakeCounter = { id: 'p2', parent_proposal_id: 'p1', status: 'pending' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(counterProposal).mockResolvedValue(fakeCounter as never)
    const res = await POST(makePostRequest({ title: 'Counter', pay_amount: 200, pay_type: 'flat_fee' }), { params })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeCounter)
  })

  it('returns 404 when parent proposal not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(counterProposal).mockRejectedValue(new DealsError('PROPOSAL_NOT_FOUND', 'Not found'))
    const res = await POST(makePostRequest({ title: 'Counter', pay_amount: 200, pay_type: 'flat_fee' }), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROPOSAL_NOT_FOUND')
  })

  it('returns 409 when parent proposal is not pending', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(counterProposal).mockRejectedValue(new DealsError('PROPOSAL_NOT_PENDING', 'Not pending'))
    const res = await POST(makePostRequest({ title: 'Counter', pay_amount: 200, pay_type: 'flat_fee' }), { params })
    expect(res.status).toBe(409)
  })

  it('returns 403 when caller is the sender', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(counterProposal).mockRejectedValue(new DealsError('NOT_RECIPIENT', 'Sender cannot counter'))
    const res = await POST(makePostRequest({ title: 'Counter', pay_amount: 200, pay_type: 'flat_fee' }), { params })
    expect(res.status).toBe(403)
  })

  // DP-11: a non-participant countering used to re-throw as a bare 500 (an
  // existence oracle). It must be a JSON 403.
  it('returns 403 for a non-participant (DP-11)', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(counterProposal).mockRejectedValue(new DealsError('NOT_PARTICIPANT', 'Not a participant'))
    const res = await POST(makePostRequest({ title: 'Counter', pay_amount: 200, pay_type: 'flat_fee' }), { params })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('NOT_PARTICIPANT')
  })

  it('rejects a junk currency and a bad amount (WS-DEAL-04 / DP-5)', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const badCurrency = await POST(
      makePostRequest({ title: 'C', pay_amount: 200, pay_type: 'flat_fee', pay_currency: '£10' }), { params }
    )
    expect(badCurrency.status).toBe(400)
    expect((await badCurrency.json()).error.code).toBe('INVALID_CURRENCY')

    const badAmount = await POST(
      makePostRequest({ title: 'C', pay_amount: 12.345, pay_type: 'flat_fee' }), { params }
    )
    expect(badAmount.status).toBe(400)
    expect((await badAmount.json()).error.code).toBe('INVALID_PAY_AMOUNT')
    expect(counterProposal).not.toHaveBeenCalled()
  })

  // DP-8: the recipient of a counter was never told. Email the OTHER participant.
  it('emails the other participant a proposal_received (DP-8)', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(counterProposal).mockResolvedValue(
      { id: 'p2', match_id: 'm1', title: 'Counter', parent_proposal_id: 'p1', status: 'pending' } as never
    )
    vi.mocked(getMatches).mockResolvedValue([
      { id: 'm1', user_a_id: 'user-1', user_b_id: 'user-2', status: 'active' } as never,
    ])
    const res = await POST(makePostRequest({ title: 'Counter', pay_amount: 200, pay_type: 'flat_fee' }), { params })
    expect(res.status).toBe(201)
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ event: 'proposal_received', userId: 'user-2' })
    )
  })
})
