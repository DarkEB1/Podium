import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock(...) calls are hoisted above this file's const declarations (Vitest
// hoists them to just under the imports), and the static `import {
// podiumProvider } from './podium'` below is itself hoisted per normal ES
// module semantics — so a plain `const insertMock = vi.fn(...)` referenced
// inside a factory would be read before its own initializer runs. vi.hoisted
// lifts the fn creation itself above that boundary.
const { insertMock, finalizeMock } = vi.hoisted(() => ({
  insertMock: vi.fn(async () => ({ id: 's1' })),
  finalizeMock: vi.fn(async () => ({ documentPath: 'contracts/c1/signed-abc.pdf', documentHash: 'x'.repeat(64) })),
}))
vi.mock('@/lib/supabase/contract-signatures', () => ({ insertContractSignature: insertMock }))
vi.mock('./finalize', () => ({ finalizeContractDocument: finalizeMock }))

const contractRow = {
  id: 'c1', brand_id: 'b1', athlete_or_team_id: 'a1', agent_id: null,
  document_url: null, terms_snapshot: {}, esignature_envelope_id: null,
}
function mockAdmin() {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'p' }, error: null })
  const single = vi.fn().mockResolvedValue({ data: contractRow, error: null })
  const eqSel = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq: eqSel }))
  const eqUpd = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq: eqUpd }))
  const from = vi.fn(() => ({ select, update }))
  const storageFrom = vi.fn(() => ({ upload }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
  return { from, storage: { from: storageFrom }, _upload: upload } as any
}
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockAdminSingleton }))
let mockAdminSingleton: ReturnType<typeof mockAdmin>

import { podiumProvider } from './podium'

describe('podiumProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSingleton = mockAdmin()
  })

  it('records a signature: uploads PNG when present, inserts the audit row', async () => {
    await podiumProvider.recordSignature(
      'c1', 'brand', 'b1',
      { typedName: 'A', consentText: 'I agree', signatureImageDataUrl: 'data:image/png;base64,AAAA', ip: '1.2.3.4', device: 'UA' },
      '2026-09-07T10:00:00.000Z'
    )
    expect(mockAdminSingleton.storage.from).toHaveBeenCalledWith('docs')
    expect(insertMock).toHaveBeenCalledWith(
      mockAdminSingleton,
      expect.objectContaining({
        contract_id: 'c1', signer_role: 'brand', signer_user_id: 'b1', typed_name: 'A',
        signature_image_path: 'contracts/c1/signatures/brand.png',
        signature_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    )
  })

  it('records without an image when none is supplied', async () => {
    await podiumProvider.recordSignature(
      'c1', 'athlete', 'a1',
      { typedName: 'B', consentText: 'I agree', ip: null, device: null },
      '2026-09-07T11:00:00.000Z'
    )
    expect(mockAdminSingleton._upload).not.toHaveBeenCalled()
    expect(insertMock).toHaveBeenCalledWith(
      mockAdminSingleton,
      expect.objectContaining({ signer_user_id: 'a1', signature_image_path: null })
    )
  })

  it('finalizeContract delegates to finalizeContractDocument', async () => {
    const out = await podiumProvider.finalizeContract('c1')
    expect(finalizeMock).toHaveBeenCalled()
    expect(out?.documentHash).toHaveLength(64)
  })
})
