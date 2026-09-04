import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/deals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/deals')>()
  return { ...actual, getProposals: vi.fn(), sendProposal: vi.fn() }
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
import { PROPOSAL_TERMS_MAX, PROPOSAL_TITLE_MAX } from '@/lib/limits'
import { getProposals, sendProposal, DealsError } from '@/lib/supabase/deals'
import { getMatches } from '@/lib/supabase/messaging'
import { sendTransactionalEmail } from '@/lib/email'
import { resolveDisplayNames } from '@/lib/email/notify'
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
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.mocked(createAdminClient).mockReturnValue({} as unknown as ReturnType<typeof createAdminClient>)
    vi.mocked(getMatches).mockResolvedValue([])
    vi.mocked(resolveDisplayNames).mockResolvedValue({ 'user-2': 'Jordan Athlete', 'user-1': 'Acme Co' })
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      status: 'sent',
      deliveryId: 'd1',
      providerId: 'p1',
    })
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

  // DP-5: sub-penny, out-of-range, and >2dp amounts are rejected server-side.
  it('rejects £0.01, huge, and >2dp amounts (DP-5)', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    for (const bad of [0.01, 1e15, 12.345]) {
      const res = await POST(makePostRequest({ match_id: 'm1', title: 'T', pay_amount: bad, pay_type: 'flat_fee' }))
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('INVALID_PAY_AMOUNT')
    }
    expect(sendProposal).not.toHaveBeenCalled()
  })

  // WS-DEAL-04: a junk currency must 400, not reach the DB and later crash the
  // deals pages via Intl.NumberFormat.
  it('rejects an unsupported/junk currency (WS-DEAL-04)', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(
      makePostRequest({ match_id: 'm1', title: 'T', pay_amount: 100, pay_type: 'flat_fee', pay_currency: '123' })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_CURRENCY')
    expect(sendProposal).not.toHaveBeenCalled()
  })

  it('normalises a supported lowercase currency to uppercase', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendProposal).mockResolvedValue({ id: 'p1' } as never)
    await POST(
      makePostRequest({ match_id: 'm1', title: 'T', pay_amount: 100, pay_type: 'flat_fee', pay_currency: 'usd' })
    )
    expect(sendProposal).toHaveBeenCalledWith(
      expect.anything(), 'm1', 'user-1', expect.objectContaining({ pay_currency: 'USD' })
    )
  })

  // DP-10: end-before-start is rejected here rather than as raw Postgres text.
  it('rejects a timeline whose end precedes its start (DP-10)', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(
      makePostRequest({
        match_id: 'm1', title: 'T', pay_amount: 100, pay_type: 'flat_fee',
        timeline_start: '2026-08-31', timeline_end: '2026-06-01',
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_TIMELINE')
    expect(sendProposal).not.toHaveBeenCalled()
  })

  // PROPOSAL_TERMS_MAX was exported from lib/limits.ts and imported by nobody,
  // and `proposals.additional_terms` is plain `text` with no CHECK, so the
  // field was unbounded all the way to the database.
  it('returns 400 when additional_terms exceeds PROPOSAL_TERMS_MAX', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(
      makePostRequest({
        match_id: 'm1',
        title: 'Test',
        pay_amount: 100,
        pay_type: 'flat_fee',
        additional_terms: 'x'.repeat(PROPOSAL_TERMS_MAX + 1),
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('TERMS_TOO_LONG')
    expect(sendProposal).not.toHaveBeenCalled()
  })

  it('accepts additional_terms exactly at the limit', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendProposal).mockResolvedValue({ id: 'p1' } as never)
    const res = await POST(
      makePostRequest({
        match_id: 'm1',
        title: 'Test',
        pay_amount: 100,
        pay_type: 'flat_fee',
        additional_terms: 'x'.repeat(PROPOSAL_TERMS_MAX),
      })
    )
    expect(res.status).toBe(201)
  })

  // `title` is the other free-text column on this insert, equally unbounded.
  // The composer already stops at 200; only the server stops a scripted caller.
  it('returns 400 when title exceeds PROPOSAL_TITLE_MAX', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(
      makePostRequest({
        match_id: 'm1',
        title: 'x'.repeat(PROPOSAL_TITLE_MAX + 1),
        pay_amount: 100,
        pay_type: 'flat_fee',
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('TITLE_TOO_LONG')
    expect(sendProposal).not.toHaveBeenCalled()
  })

  it('accepts a title exactly at the limit', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendProposal).mockResolvedValue({ id: 'p1' } as never)
    const res = await POST(
      makePostRequest({
        match_id: 'm1',
        title: 'x'.repeat(PROPOSAL_TITLE_MAX),
        pay_amount: 100,
        pay_type: 'flat_fee',
      })
    )
    expect(res.status).toBe(201)
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

  it('emails the OTHER match participant a proposal_received on success', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendProposal).mockResolvedValue(
      { id: 'p1', match_id: 'm1', title: 'Summer Campaign', sender_id: 'user-1' } as never
    )
    vi.mocked(getMatches).mockResolvedValue([
      { id: 'm1', user_a_id: 'user-1', user_b_id: 'user-2', status: 'active' } as never,
    ])
    await POST(makePostRequest({ match_id: 'm1', title: 'Summer Campaign', pay_amount: 5000, pay_type: 'flat_fee' }))
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'proposal_received',
        userId: 'user-2',
        data: expect.objectContaining({
          recipientName: 'Jordan Athlete',
          senderName: 'Acme Co',
          proposalTitle: 'Summer Campaign',
        }),
      })
    )
  })

  it('does NOT email when sendProposal fails', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendProposal).mockRejectedValue(new DealsError('PROPOSAL_INSERT_FAILED', 'insert failed'))
    const res = await POST(makePostRequest({ match_id: 'm1', title: 'Test', pay_amount: 500, pay_type: 'flat_fee' }))
    expect(res.status).toBe(422)
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('answers the authorization errors send_proposal now raises, as JSON', async () => {
    // send_proposal is SECURITY DEFINER and does its own participant check, so
    // these reach the route. Re-thrown they would be an empty, unparseable 500.
    for (const [code, status] of [
      ['NOT_PARTICIPANT', 403],
      ['MATCH_NOT_FOUND', 404],
    ] as const) {
      vi.mocked(getUser).mockResolvedValue(fakeUser as never)
      vi.mocked(sendProposal).mockRejectedValue(new DealsError(code, 'nope'))
      const res = await POST(
        makePostRequest({ match_id: 'm1', title: 'Test', pay_amount: 500, pay_type: 'flat_fee' })
      )
      expect(res.status).toBe(status)
      const json = await res.json()
      expect(json.error.code).toBe(code)
    }
  })
})
