import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const isAuthorized = vi.fn()
const jobA = vi.fn()
const jobB = vi.fn()

vi.mock('@/lib/cron/auth', () => ({
  isAuthorizedCronRequest: (...a: unknown[]) => isAuthorized(...a),
  cronUnauthorized: () => new Response(null, { status: 401 }),
}))
vi.mock('@/lib/observability', () => ({
  withRequestContext: () => ({ captureMessage: vi.fn(), captureException: vi.fn() }),
}))
vi.mock('@/lib/cron/daily-jobs', () => ({
  DAILY_CRON_JOBS: [
    { path: '/api/cron/a', run: (...a: unknown[]) => jobA(...a) },
    { path: '/api/cron/b', run: (...a: unknown[]) => jobB(...a) },
  ],
}))

import { GET, POST } from './route'

function req() {
  return new NextRequest('https://podium.test/api/cron/daily')
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  process.env.CRON_SECRET = 'secret'
  isAuthorized.mockReset()
  jobA.mockReset()
  jobB.mockReset()
})

describe('GET/POST /api/cron/daily (Hobby-plan consolidated runner)', () => {
  it('401s an unauthorised request and never runs a job', async () => {
    isAuthorized.mockReturnValue(false)
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(jobA).not.toHaveBeenCalled()
    expect(jobB).not.toHaveBeenCalled()
  })

  it('runs every job with the forwarded request and reports per-job results', async () => {
    isAuthorized.mockReturnValue(true)
    jobA.mockResolvedValue(jsonResponse(200, { ok: true, cleared: 3 }))
    jobB.mockResolvedValue(jsonResponse(200, { ok: true }))
    const request = req()
    const res = await POST(request)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      failed: [],
      results: [
        { path: '/api/cron/a', status: 200, body: { ok: true, cleared: 3 } },
        { path: '/api/cron/b', status: 200, body: { ok: true } },
      ],
    })
    expect(jobA).toHaveBeenCalledWith(request)
    expect(jobB).toHaveBeenCalledWith(request)
  })

  it('keeps running after a job fails and surfaces the failure as a 500', async () => {
    isAuthorized.mockReturnValue(true)
    jobA.mockResolvedValue(jsonResponse(500, { error: { code: 'CRON_JOB_FAILED' } }))
    jobB.mockResolvedValue(jsonResponse(200, { ok: true }))
    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.failed).toEqual(['/api/cron/a'])
    expect(jobB).toHaveBeenCalled()
  })

  it('treats a thrown (not returned) job error the same way', async () => {
    isAuthorized.mockReturnValue(true)
    jobA.mockRejectedValue(new Error('boom'))
    jobB.mockResolvedValue(jsonResponse(200, { ok: true }))
    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.failed).toEqual(['/api/cron/a'])
    expect(body.results[0]).toEqual({ path: '/api/cron/a', status: 500, body: null })
    expect(jobB).toHaveBeenCalled()
  })
})
