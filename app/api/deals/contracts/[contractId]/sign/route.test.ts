import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: vi.fn(), getUserRole: vi.fn() }))
vi.mock('@/lib/supabase/deals', () => ({
  signContract: vi.fn(),
  DealsError: class DealsError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
      this.name = 'DealsError'
    }
  },
}))
vi.mock('@/lib/email', () => ({ sendTransactionalEmail: vi.fn() }))
vi.mock('@/lib/email/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/notify')>()
  return { ...actual, resolveDisplayNames: vi.fn() }
})
vi.mock('@/lib/notifications', () => ({ dispatchNotification: vi.fn() }))

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser, getUserRole } from '@/lib/supabase/auth'
import { signContract, DealsError } from '@/lib/supabase/deals'
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
})

function makeRequest(contractId: string, body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost/api/deals/contracts/${contractId}/sign`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

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

  it('returns 200 with updated contract when signing succeeds', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(signContract).mockResolvedValue(fakeContract as never)

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('c1')
    expect(vi.mocked(signContract)).toHaveBeenCalledWith(
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
    vi.mocked(signContract).mockResolvedValue(fakeContract as never)

    const request = new NextRequest('http://localhost/api/deals/contracts/c1/sign', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'user-agent': 'Mozilla/5.0 (Macintosh)',
      },
    })
    await POST(request, { params: Promise.resolve({ contractId: 'c1' }) })

    expect(vi.mocked(signContract)).toHaveBeenCalledWith(
      mockSupabase,
      mockAdmin,
      'c1',
      'brand1',
      { ip: '1.2.3.4', device: 'Mozilla/5.0 (Macintosh)' }
    )
  })

  it('returns 404 when contract not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(signContract).mockRejectedValue(new DealsError('CONTRACT_NOT_FOUND', 'not found'))

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('CONTRACT_NOT_FOUND')
  })

  it('returns 403 when user is not a participant', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(signContract).mockRejectedValue(new DealsError('NOT_PARTICIPANT', 'not a participant'))

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 409 when already signed', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(signContract).mockRejectedValue(new DealsError('ALREADY_SIGNED', 'already signed'))

    const res = await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(res.status).toBe(409)
  })

  // WS-MSG-09: the signature that completes a contract emails BOTH parties a
  // keyed contract_fully_signed (previously never fired) + an in-app bell row.
  it('emails and notifies both parties when the contract becomes fully signed', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(signContract).mockResolvedValue(
      { ...fakeContract, status: 'fully_signed', athlete_signed_at: '2026-06-02T00:00:00Z' } as never
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
    vi.mocked(signContract).mockResolvedValue(fakeContract as never)
    await POST(makeRequest('c1'), { params: Promise.resolve({ contractId: 'c1' }) })
    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled()
    expect(vi.mocked(dispatchNotification)).not.toHaveBeenCalled()
  })
})
