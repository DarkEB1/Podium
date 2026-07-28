import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const rpc = vi.fn()
const isAuthorized = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ rpc }),
}))
vi.mock('@/lib/cron/auth', () => ({
  isAuthorizedCronRequest: (...a: unknown[]) => isAuthorized(...a),
  cronUnauthorized: () => new Response(null, { status: 401 }),
}))
vi.mock('@/lib/observability', () => ({
  withRequestContext: () => ({ captureMessage: vi.fn(), captureException: vi.fn() }),
}))

import { GET, POST } from './route'

function req() {
  return new NextRequest('https://podium.test/api/cron/chat-cleanup')
}

beforeEach(() => {
  process.env.CRON_SECRET = 'secret'
  rpc.mockReset()
  isAuthorized.mockReset()
})

describe('GET/POST /api/cron/chat-cleanup (2.5 Flow 43)', () => {
  it('401s an unauthorised request and never calls the RPC', async () => {
    isAuthorized.mockReturnValue(false)
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('runs clear_expired_chat_messages and returns the count', async () => {
    isAuthorized.mockReturnValue(true)
    rpc.mockResolvedValue({ data: 7, error: null })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, messages_cleared: 7 })
    expect(rpc).toHaveBeenCalledWith('clear_expired_chat_messages')
  })

  it('500s when the RPC errors', async () => {
    isAuthorized.mockReturnValue(true)
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('CRON_JOB_FAILED')
  })
})
