import { describe, it, expect, vi, beforeEach } from 'vitest'

const { renderMock } = vi.hoisted(() => ({
  renderMock: vi.fn(async () => Buffer.from('%PDF-1.7 fake')),
}))
vi.mock('./pdf', () => ({
  renderContractPdf: renderMock,
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
// Rich party detail has its own unit tests (agreement-parties.test.ts); mock it
// here so finalize's test stays focused on assembly + storage.
const partyCtx = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))
vi.mock('@/lib/supabase/agreement-parties', () => ({
  getAgreementPartyContext: vi.fn(async () => partyCtx.value),
}))

import { finalizeContractDocument } from './finalize'
import { getContractSignatures } from '@/lib/supabase/contract-signatures'

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
  beforeEach(() => {
    vi.clearAllMocks()
    partyCtx.value = {}
  })

  it('passes the parties legal names and the minor guardian into the PDF', async () => {
    partyCtx.value = {
      brand1: { legalName: 'Brand One Ltd', company: 'Brand One', email: 'b@x.test', descriptor: null, representativeName: null, representativeTitle: null, isMinor: false, guardian: null },
      ath1: { legalName: 'Ath Onefull', company: null, email: 'a@x.test', descriptor: 'Athletics', representativeName: null, representativeTitle: null, isMinor: true, guardian: { name: 'Guardian G', relationship: 'Parent' } },
    }
    await finalizeContractDocument(mockAdmin(), CONTRACT)
    const arg = (renderMock.mock.calls[0] as unknown[])[0] as {
      parties: { role: string; legalName?: string | null }[]
      isMinor?: boolean
      guardian?: { name: string } | null
    }
    expect(arg.isMinor).toBe(true)
    expect(arg.guardian).toEqual({ name: 'Guardian G', relationship: 'Parent' })
    expect(arg.parties.find((p) => p.role === 'brand')!.legalName).toBe('Brand One Ltd')
    expect(arg.parties.find((p) => p.role === 'athlete')!.legalName).toBe('Ath Onefull')
  })

  it('passes the athlete signature payment details into the PDF (P2P)', async () => {
    vi.mocked(getContractSignatures).mockResolvedValueOnce([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
      { signer_role: 'brand', typed_name: 'A', signed_at: '2026-09-07T10:00:00.000Z', signer_ip: '1.1.1.1', signature_hash: 'h1', signature_image_path: null, payment_details: null } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
      { signer_role: 'athlete', typed_name: 'B', signed_at: '2026-09-07T11:00:00.000Z', signer_ip: '2.2.2.2', signature_hash: 'h2', signature_image_path: null, payment_details: { accountHolderName: 'B Payee', accountNumber: '12345678', sortCode: '20-00-00' } } as any,
    ])
    await finalizeContractDocument(mockAdmin(), CONTRACT)
    const arg = (renderMock.mock.calls[0] as unknown[])[0] as {
      paymentDetails?: { accountHolderName?: string; accountNumber?: string } | null
    }
    expect(arg.paymentDetails).toEqual({
      accountHolderName: 'B Payee',
      accountNumber: '12345678',
      sortCode: '20-00-00',
    })
  })

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
