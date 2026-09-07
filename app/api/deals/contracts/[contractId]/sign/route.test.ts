import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  createClient: async () => ({}),
  createAdminClient: () => ({}),
}))
vi.mock('@/lib/supabase/auth', () => ({
  getUser: async () => ({ id: 'brand1' }),
  getUserRole: async () => 'brand',
}))
// The fully-signed notification helpers are exercised elsewhere; stub to no-ops.
vi.mock('@/lib/email', () => ({ sendTransactionalEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/email/notify', () => ({
  absoluteUrl: (p: string) => `https://x${p}`, nameOf: () => 'N',
  resolveDisplayNames: async () => ({}), FALLBACK_OTHER_NAME: 'the other party',
}))
vi.mock('@/lib/notifications', () => ({ dispatchNotification: vi.fn(async () => {}) }))
vi.mock('@/lib/notifications/deep-links', () => ({ dealDetailPath: () => '/deal' }))
vi.mock('@/lib/supabase/guardian', () => ({ buildGuardianDealNotice: async () => null }))
vi.mock('@/lib/email/guardian', () => ({ sendGuardianDealNoticeEmail: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ clientIpFrom: () => '1.2.3.4' }))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'UA' },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest shim
  }) as any
}
const params = { params: Promise.resolve({ contractId: 'c1' }) }

describe('POST sign', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing consent with 400', async () => {
    const res = await POST(req({ typedName: 'A', consent: false }), params)
    expect(res.status).toBe(400)
    expect(mockSignContract).not.toHaveBeenCalled()
  })

  it('signs, records, and does NOT finalize when only one party has signed', async () => {
    mockSignContract.mockResolvedValue({
      id: 'c1', status: 'pending_athlete_signature', brand_id: 'brand1',
      athlete_or_team_id: 'ath1', brand_signed_at: '2026-09-07T10:00:00.000Z',
    })
    const res = await POST(req({ typedName: 'A Buyer', consent: true }), params)
    expect(res.status).toBe(200)
    expect(mockRecordSignature).toHaveBeenCalledWith(
      'c1', 'brand', 'brand1',
      expect.objectContaining({ typedName: 'A Buyer', consentText: expect.any(String) }),
      '2026-09-07T10:00:00.000Z'
    )
    expect(mockFinalize).not.toHaveBeenCalled()
  })

  it('finalizes when this signature completes the contract', async () => {
    mockSignContract.mockResolvedValue({
      id: 'c1', status: 'fully_signed', brand_id: 'brand1', athlete_or_team_id: 'ath1',
      brand_signed_at: '2026-09-07T10:00:00.000Z', athlete_signed_at: '2026-09-07T11:00:00.000Z',
      proposal_id: 'p1',
    })
    const res = await POST(req({ typedName: 'A Buyer', consent: true }), params)
    expect(res.status).toBe(200)
    expect(mockFinalize).toHaveBeenCalledWith('c1')
  })
})
