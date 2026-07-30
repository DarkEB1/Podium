import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: vi.fn() }))
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

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { signContract, DealsError } from '@/lib/supabase/deals'

const mockSupabase = {} as ReturnType<typeof createClient> extends Promise<infer T> ? T : never
const mockAdmin = {} as ReturnType<typeof createAdminClient>

beforeEach(() => {
  vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
  vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)
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
})
