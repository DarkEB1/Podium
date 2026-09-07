import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted above the whole module, so any mock fn they
// reference must be created via vi.hoisted() to survive that reordering.
const { signedUrl, mockFinalize } = vi.hoisted(() => ({
  signedUrl: vi.fn(async () => 'https://signed.example/doc.pdf?token=abc'),
  mockFinalize: vi.fn(async () => null as { documentPath: string; documentHash: string } | null),
}))
vi.mock('@/lib/storage', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>)
  return { ...actual, createSignedDownloadUrl: signedUrl }
})
vi.mock('@/lib/esign', () => ({
  provider: () => ({ name: 'podium', recordSignature: vi.fn(), finalizeContract: mockFinalize }),
}))

let contractRow: unknown = { id: 'c1', status: 'fully_signed', document_url: 'contracts/c1/signed-a.pdf' }
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: contractRow, error: contractRow ? null : { code: 'PGRST116' } }),
        }),
      }),
    }),
  }),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: async () => ({ id: 'brand1' }) }))

import { GET } from './route'
const params = { params: Promise.resolve({ contractId: 'c1' }) }

describe('GET contract document', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contractRow = { id: 'c1', status: 'fully_signed', document_url: 'contracts/c1/signed-a.pdf' }
    mockFinalize.mockResolvedValue(null)
  })

  it('redirects a participant to a signed URL', async () => {
    const res = await GET(new Request('http://x') as any, params)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('signed.example')
  })

  it('404s when the contract is not visible / has no document', async () => {
    contractRow = null
    const res = await GET(new Request('http://x') as any, params)
    expect(res.status).toBe(404)
  })

  it('lazily re-finalizes a fully-signed contract whose PDF generation failed earlier, then redirects', async () => {
    // document_url starts null; finalize "succeeds" by making the row visible
    // with a document_url on the re-select.
    contractRow = { id: 'c1', status: 'fully_signed', document_url: null }
    mockFinalize.mockImplementation(async () => {
      contractRow = { id: 'c1', status: 'fully_signed', document_url: 'contracts/c1/signed-b.pdf' }
      return { documentPath: 'contracts/c1/signed-b.pdf', documentHash: 'h' }
    })

    const res = await GET(new Request('http://x') as any, params)

    expect(mockFinalize).toHaveBeenCalledWith('c1')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('signed.example')
    expect(signedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'contracts/c1/signed-b.pdf')
  })

  it('404s and does not finalize when the contract is not fully signed and has no document', async () => {
    contractRow = { id: 'c1', status: 'pending_athlete_signature', document_url: null }
    const res = await GET(new Request('http://x') as any, params)
    expect(res.status).toBe(404)
    expect(mockFinalize).not.toHaveBeenCalled()
  })

  it('404s when finalize runs but still leaves document_url null', async () => {
    contractRow = { id: 'c1', status: 'fully_signed', document_url: null }
    mockFinalize.mockResolvedValue(null) // stays null on re-select
    const res = await GET(new Request('http://x') as any, params)
    expect(mockFinalize).toHaveBeenCalledWith('c1')
    expect(res.status).toBe(404)
  })
})
