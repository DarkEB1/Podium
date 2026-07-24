import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

const processScheduledDeletions = vi.fn()
const createAdminClient = vi.fn(() => ({ __admin: true }))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => createAdminClient(),
}))

vi.mock('@/lib/supabase/auth', () => ({
  processScheduledDeletions: (...args: unknown[]) => processScheduledDeletions(...args),
}))

const SECRET = 'super-secret-cron-token'

function request(headers: Record<string, string> = {}) {
  return new NextRequest('https://podium.test/api/cron/gdpr-deletion', { headers })
}

describe('GET /api/cron/gdpr-deletion (DI-4 / CL-3)', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET
    processScheduledDeletions.mockReset()
    processScheduledDeletions.mockResolvedValue({
      processed_at: '2026-07-20T03:00:00.000Z',
      erased: 2,
      failed: 0,
      results: [
        { user_id: 'user-1', status: 'erased', counts: { messages: 4 } },
        { user_id: 'user-2', status: 'erased', counts: { messages: 0 } },
      ],
    })
    createAdminClient.mockClear()
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  it('rejects a request with no Authorization header', async () => {
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(processScheduledDeletions).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret', async () => {
    const res = await GET(request({ authorization: `Bearer wrong-token-value` }))
    expect(res.status).toBe(401)
    expect(processScheduledDeletions).not.toHaveBeenCalled()
  })

  it('rejects a non-Bearer scheme even when the secret is right', async () => {
    const res = await GET(request({ authorization: `Basic ${SECRET}` }))
    expect(res.status).toBe(401)
  })

  it('rejects everything when CRON_SECRET is unset (fails closed)', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(request({ authorization: 'Bearer ' }))
    expect(res.status).toBe(401)
    expect(processScheduledDeletions).not.toHaveBeenCalled()
  })

  it('runs the erasure job with the service-role client and summarises it', async () => {
    const res = await GET(request({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)

    expect(createAdminClient).toHaveBeenCalledTimes(1)
    expect(processScheduledDeletions).toHaveBeenCalledWith({ __admin: true }, 100)

    const body = await res.json()
    expect(body).toMatchObject({ ok: true, erased: 2, failed: 0 })
    expect(body.results).toEqual([
      { user_id: 'user-1', status: 'erased' },
      { user_id: 'user-2', status: 'erased' },
    ])
    // Per-user counts are not echoed back into cron logs.
    expect(JSON.stringify(body)).not.toContain('counts')
  })

  it('accepts a manual POST trigger with the same secret', async () => {
    const res = await POST(request({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)
  })

  it('returns 500 when the job throws', async () => {
    processScheduledDeletions.mockRejectedValue(new Error('boom'))
    const res = await GET(request({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('GDPR_DELETION_FAILED')
  })
})
