import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.mock factories are hoisted above the whole module, so the mocks they
// reference must be created via vi.hoisted() to survive that reordering.
const { mockSignContract, mockRecordSignature, mockFinalize } = vi.hoisted(() => ({
  mockSignContract: vi.fn(),
  mockRecordSignature: vi.fn(async () => {}),
  mockFinalize: vi.fn(async () => ({ documentPath: 'contracts/c1/signed-a.pdf', documentHash: 'h' })),
}))

vi.mock('@/lib/supabase/deals', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>)
  return { ...actual, signContract: mockSignContract }
})
vi.mock('@/lib/esign', () => ({
  provider: () => ({ name: 'podium', recordSignature: mockRecordSignature, finalizeContract: mockFinalize }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: vi.fn(), getUserRole: vi.fn() }))
// The fully-signed notification helpers are exercised in detail below; the
// guardian and rate-limit helpers are exercised elsewhere, so stub those to
// no-ops.
vi.mock('@/lib/email', () => ({ sendTransactionalEmail: vi.fn() }))
vi.mock('@/lib/email/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/notify')>()
  return { ...actual, resolveDisplayNames: vi.fn() }
})
vi.mock('@/lib/notifications', () => ({ dispatchNotification: vi.fn() }))
vi.mock('@/lib/notifications/deep-links', () => ({ dealDetailPath: () => '/deal' }))
vi.mock('@/lib/supabase/guardian', () => ({ buildGuardianDealNotice: async () => null }))
vi.mock('@/lib/email/guardian', () => ({ sendGuardianDealNoticeEmail: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ clientIpFrom: () => '1.2.3.4' }))

import { POST } from './route'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser, getUserRole } from '@/lib/supabase/auth'
import { DealsError } from '@/lib/supabase/deals'
import { sendTransactionalEmail } from '@/lib/email'
import { resolveDisplayNames } from '@/lib/email/notify'
import { dispatchNotification } from '@/lib/notifications'

const mockSupabase = {} as ReturnType<typeof createClient> extends Promise<infer T> ? T : never
const mockAdmin = {} as ReturnType<typeof createAdminClient>

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
  vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)
  vi.mocked(getUserRole).mockResolvedValue('brand')
  vi.mocked(resolveDisplayNames).mockResolvedValue({ brand1: 'Acme Co', athlete1: 'Jordan Athlete' })
  vi.mocked(sendTransactionalEmail).mockResolvedValue({ status: 'sent', deliveryId: 'd1', providerId: 'p1' })
  mockRecordSignature.mockResolvedValue(undefined)
  mockFinalize.mockResolvedValue({ documentPath: 'contracts/c1/signed-a.pdf', documentHash: 'h' })
})

function makeRequest(contractId: string, body: Record<string, unknown> = { typedName: 'A Buyer', consent: true }) {
  return new NextRequest(`http://localhost/api/deals/contracts/${contractId}/sign`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function req(body: unknown) {
  return new Request('http://x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'UA' },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest shim
  }) as any
}
const params = { params: Promise.resolve({ contractId: 'c1' }) }

const fakeUser = { id: 'brand1', role: 'brand', email: 'brand@example.com' }
const fakeContract = {
  id: 'c1',
  proposal_id: 'p1',
  brand_id: 'brand1',
  athlete_or_team_id: 'athlete1',
  status: 'pending_athlete_signature',
  brand_signed_at: '2026-06-01T00:00:00Z',
  athlete_signed_at: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
}

describe('POST /api/deals/contracts/[contractId]/sign', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('rejects a missing consent with 400 before calling signContract', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(req({ typedName: 'A', consent: false }), params)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('SIGNATURE_INVALID')
    expect(mockSignContract).not.toHaveBeenCalled()
  })

  it('rejects a blank typed name with 400', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(req({ typedName: '   ', consent: true }), params)
    expect(res.status).toBe(400)
    expect(mockSignContract).not.toHaveBeenCalled()
  })

  it('returns 200 with updated contract when signing succeeds', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockResolvedValue(fakeContract)

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('c1')
    expect(mockSignContract).toHaveBeenCalledWith(
      mockSupabase,
      mockAdmin,
      'c1',
      'brand1',
      expect.any(Object)
    )
  })

  it('passes the signer IP and device through for the audit trail', async () => {
    // QA-1.6 / spec 11.6: only this layer can see the request, so it is what
    // captures where a signature came from.
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockResolvedValue(fakeContract)

    const request = new NextRequest('http://localhost/api/deals/contracts/c1/sign', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'user-agent': 'Mozilla/5.0 (Macintosh)',
      },
      body: JSON.stringify({ typedName: 'A Buyer', consent: true }),
    })
    await POST(request, { params: Promise.resolve({ contractId: 'c1' }) })

    expect(mockSignContract).toHaveBeenCalledWith(
      mockSupabase,
      mockAdmin,
      'c1',
      'brand1',
      { ip: '1.2.3.4', device: 'Mozilla/5.0 (Macintosh)' }
    )
  })

  it('records the signer via the e-sign provider, keyed to this party\'s signed_at', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockResolvedValue(fakeContract)

    await POST(makeRequest('c1', { typedName: 'A Buyer', consent: true }), { params: Promise.resolve({ contractId: 'c1' }) })

    expect(mockRecordSignature).toHaveBeenCalledWith(
      'c1', 'brand', 'brand1',
      expect.objectContaining({ typedName: 'A Buyer', consentText: expect.any(String) }),
      fakeContract.brand_signed_at
    )
    expect(mockFinalize).not.toHaveBeenCalled()
  })

  it('finalizes the signed PDF when this signature completes the contract', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockResolvedValue(
      { ...fakeContract, status: 'fully_signed', athlete_signed_at: '2026-06-02T00:00:00Z' }
    )

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(200)
    expect(mockFinalize).toHaveBeenCalledWith('c1')
  })

  it('returns 404 when contract not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockRejectedValue(new DealsError('CONTRACT_NOT_FOUND', 'not found'))

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('CONTRACT_NOT_FOUND')
  })

  it('returns 403 when user is not a participant', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockRejectedValue(new DealsError('NOT_PARTICIPANT', 'not a participant'))

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 409 when already signed', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockRejectedValue(new DealsError('ALREADY_SIGNED', 'already signed'))

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(409)
  })

  it('returns 403 when guardian consent is required', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockRejectedValue(new DealsError('GUARDIAN_CONSENT_REQUIRED', 'consent required'))

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('GUARDIAN_CONSENT_REQUIRED')
  })

  // WS-MSG-09: the signature that completes a contract emails BOTH parties a
  // keyed contract_fully_signed (previously never fired) + an in-app bell row.
  it('emails and notifies both parties when the contract becomes fully signed', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockResolvedValue(
      { ...fakeContract, status: 'fully_signed', athlete_signed_at: '2026-06-02T00:00:00Z' }
    )

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(200)

    for (const userId of ['brand1', 'athlete1']) {
      expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledWith(
        mockAdmin,
        expect.objectContaining({
          event: 'contract_fully_signed',
          userId,
          idempotencyKey: `contract_fully_signed:c1:${userId}`,
        })
      )
      expect(vi.mocked(dispatchNotification)).toHaveBeenCalledWith(
        mockAdmin,
        expect.objectContaining({ userId, eventType: 'contract_fully_signed' })
      )
    }
  })

  it('does NOT send a fully-signed email on a first (partial) signature', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    mockSignContract.mockResolvedValue(fakeContract)
    await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled()
    expect(vi.mocked(dispatchNotification)).not.toHaveBeenCalled()
  })
})
