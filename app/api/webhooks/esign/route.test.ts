import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

const SECRET = 'a-very-long-shared-webhook-secret-123456'
// vi.mock factories are hoisted above the whole module, so any mock fn they
// reference must be created via vi.hoisted() to survive that reordering.
const { finalizeMock, terminateMock } = vi.hoisted(() => ({
  finalizeMock: vi.fn(async () => ({ documentPath: 'p', documentHash: 'h' })),
  terminateMock: vi.fn(async () => {}),
}))
vi.mock('@/lib/esign', () => ({ provider: () => ({ name: 'podium', finalizeContract: finalizeMock, recordSignature: vi.fn() }) }))

let contractRow: unknown = { id: 'c1', esignature_envelope_id: 'env1' }
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({}),
}))
vi.mock('@/lib/supabase/contracts', () => ({
  getContractByEsignEnvelopeId: async () => contractRow,
  terminateContract: terminateMock,
}))

// F11: mutable so the "unset secret" test can null it out without a separate
// module mock.
let webhookSecret: string | undefined = SECRET
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ ESIGN_WEBHOOK_SECRET: webhookSecret }) }))

import { POST } from './route'

function signed(body: string, sig = createHmac('sha256', SECRET).update(body).digest('hex')) {
  return (
    new Request('http://x', { method: 'POST', headers: { 'x-esign-signature': sig }, body })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
  ) as any
}

describe('POST /api/webhooks/esign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contractRow = { id: 'c1', esignature_envelope_id: 'env1' }
    webhookSecret = SECRET
  })

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
    expect(terminateMock).toHaveBeenCalledWith(expect.anything(), 'c1', 'changed mind')
  })

  // F11 (M5) — security-path coverage the wave review flagged as missing.
  it('returns 500 WEBHOOK_NOT_CONFIGURED when ESIGN_WEBHOOK_SECRET is unset, and never finalizes', async () => {
    webhookSecret = undefined
    const body = JSON.stringify({ event: 'completed', envelopeId: 'env1' })
    const res = await POST(signed(body))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error.code).toBe('WEBHOOK_NOT_CONFIGURED')
    expect(finalizeMock).not.toHaveBeenCalled()
  })

  it('rejects a request with no x-esign-signature header with 400', async () => {
    const body = JSON.stringify({ event: 'completed', envelopeId: 'env1' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
    const req = new Request('http://x', { method: 'POST', body }) as any
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(finalizeMock).not.toHaveBeenCalled()
  })

  it('rejects a validly-signed but non-JSON body with 400', async () => {
    const body = 'not json at all'
    const res = await POST(signed(body))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_BODY')
    expect(finalizeMock).not.toHaveBeenCalled()
  })
})
