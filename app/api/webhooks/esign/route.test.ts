import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

const SECRET = 'a-very-long-shared-webhook-secret-123456'
const finalizeMock = vi.fn(async () => ({ documentPath: 'p', documentHash: 'h' }))
vi.mock('@/lib/esign', () => ({ provider: () => ({ name: 'podium', finalizeContract: finalizeMock, recordSignature: vi.fn() }) }))

let contractRow: unknown = { id: 'c1', esignature_envelope_id: 'env1' }
const updateEq = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: contractRow, error: contractRow ? null : { code: 'PGRST116' } }) }) }),
      update: () => ({ eq: updateEq }),
    }),
  }),
}))
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ ESIGN_WEBHOOK_SECRET: SECRET }) }))

import { POST } from './route'

function signed(body: string, sig = createHmac('sha256', SECRET).update(body).digest('hex')) {
  return new Request('http://x', { method: 'POST', headers: { 'x-esign-signature': sig }, body }) as any
}

describe('POST /api/webhooks/esign', () => {
  beforeEach(() => { vi.clearAllMocks(); contractRow = { id: 'c1', esignature_envelope_id: 'env1' } })

  it('rejects a bad signature with 400 before processing', async () => {
    const body = JSON.stringify({ event: 'completed', envelopeId: 'env1' })
    const res = await POST(signed(body, 'deadbeef'))
    expect(res.status).toBe(400)
    expect(finalizeMock).not.toHaveBeenCalled()
  })

  it('finalizes on completed', async () => {
    const body = JSON.stringify({ event: 'completed', envelopeId: 'env1' })
    const res = await POST(signed(body))
    expect(res.status).toBe(200)
    expect(finalizeMock).toHaveBeenCalledWith('c1')
  })

  it('terminates on declined', async () => {
    const body = JSON.stringify({ event: 'declined', envelopeId: 'env1', reason: 'changed mind' })
    const res = await POST(signed(body))
    expect(res.status).toBe(200)
    expect(updateEq).toHaveBeenCalled()
  })
})
