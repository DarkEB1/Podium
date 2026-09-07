import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./pdf', () => ({
  renderContractPdf: vi.fn(async () => Buffer.from('%PDF-1.7 fake')),
}))
vi.mock('@/lib/supabase/contract-signatures', () => ({
  getContractSignatures: vi.fn(async () => [
    { signer_role: 'brand', typed_name: 'A', signed_at: '2026-09-07T10:00:00.000Z', signer_ip: '1.1.1.1', signature_hash: 'h1', signature_image_path: null },
    { signer_role: 'athlete', typed_name: 'B', signed_at: '2026-09-07T11:00:00.000Z', signer_ip: '2.2.2.2', signature_hash: 'h2', signature_image_path: null },
  ]),
}))
vi.mock('@/lib/email/notify', () => ({
  resolveDisplayNames: vi.fn(async () => ({ brand1: 'Brand One', ath1: 'Ath One' })),
  // The mock factory replaces the whole module, so nameOf/FALLBACK_OTHER_NAME
  // (also imported by finalize.ts) must be stubbed too, mirroring their real
  // behaviour in lib/email/notify.ts.
  nameOf: (names: Record<string, string>, userId: string, fallback = 'Someone') => names[userId] ?? fallback,
  FALLBACK_OTHER_NAME: 'Someone',
}))

import { finalizeContractDocument } from './finalize'

const TERMS = {
  title: 'Deal', deliverables: '3 posts', pay_amount: 5000, pay_currency: 'GBP',
  pay_type: 'flat_fee', timeline_start: '2026-06-01', timeline_end: '2026-08-31',
  usage_rights: 'Social', additional_terms: 'None',
}
const CONTRACT = {
  id: 'c1', brand_id: 'brand1', athlete_or_team_id: 'ath1', agent_id: null,
  document_url: null, terms_snapshot: TERMS,
}

function mockAdmin() {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'contracts/c1/signed-abc.pdf' }, error: null })
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn((table: string) =>
    table === 'contracts'
      ? { update }
      : { upload }
  )
  const storageFrom = vi.fn(() => ({ upload }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
  return { from, storage: { from: storageFrom }, _update: update, _upload: upload } as any
}

describe('finalizeContractDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders, uploads and writes document_url + document_hash', async () => {
    const admin = mockAdmin()
    const out = await finalizeContractDocument(admin, CONTRACT)
    expect(out).not.toBeNull()
    expect(out!.documentPath).toMatch(/^contracts\/c1\/signed-[0-9a-f]{8}\.pdf$/)
    expect(out!.documentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(admin.storage.from).toHaveBeenCalledWith('docs')
    expect(admin._update).toHaveBeenCalledWith(
      expect.objectContaining({ document_url: out!.documentPath, document_hash: out!.documentHash })
    )
  })

  it('is a no-op when the contract is already finalized', async () => {
    const admin = mockAdmin()
    const out = await finalizeContractDocument(admin, { ...CONTRACT, document_url: 'contracts/c1/signed-x.pdf' })
    expect(out).toBeNull()
    expect(admin._upload).not.toHaveBeenCalled()
  })
})
