import { describe, it, expect, vi } from 'vitest'
import { insertContractSignature, getContractSignatures } from './contract-signatures'

function mockAdmin(returned: unknown) {
  const single = vi.fn().mockResolvedValue({ data: returned, error: null })
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const order = vi.fn().mockResolvedValue({ data: [returned], error: null })
  const eq = vi.fn(() => ({ order }))
  const selectList = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ insert, select: selectList }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
  return { from } as any
}

const ROW = {
  id: 's1', contract_id: 'c1', signer_role: 'brand', signer_user_id: 'u1',
  typed_name: 'Ada Brand', signature_image_path: null, consent_text: 'I agree',
  signer_ip: '1.2.3.4', signer_device: 'UA', signed_at: '2026-09-07T00:00:00.000Z',
  signature_hash: 'abc', created_at: '2026-09-07T00:00:00.000Z',
}

describe('contract-signatures', () => {
  it('inserts a signature row and returns it', async () => {
    const admin = mockAdmin(ROW)
    const out = await insertContractSignature(admin, {
      contract_id: 'c1', signer_role: 'brand', signer_user_id: 'u1',
      typed_name: 'Ada Brand', consent_text: 'I agree', signer_ip: '1.2.3.4',
      signer_device: 'UA', signed_at: ROW.signed_at, signature_hash: 'abc',
    })
    expect(out.id).toBe('s1')
    expect(admin.from).toHaveBeenCalledWith('contract_signatures')
  })

  it('lists signatures for a contract', async () => {
    const admin = mockAdmin(ROW)
    const out = await getContractSignatures(admin, 'c1')
    expect(out).toHaveLength(1)
    expect(out[0]!.signer_role).toBe('brand')
  })
})
