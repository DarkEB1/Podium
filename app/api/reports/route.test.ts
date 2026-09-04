import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/admin')>()
  return { ...actual, createReport: vi.fn(), getOwnReports: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { createReport, getOwnReports, AdminError } from '@/lib/supabase/admin'
import { REPORT_DETAIL_MAX } from '@/lib/limits'
import { GET, POST } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'user@test.com',
  role: 'athlete' as const,
  role_locked_at: '2026-04-01T00:00:00Z',
}

const fakeReport = {
  id: 'report-1',
  reporter_id: 'user-1',
  reported_user_id: '00000000-0000-4000-8000-000000000002',
  reported_message_id: null,
  reason: 'spam' as const,
  detail: null,
  status: 'pending' as const,
  admin_notes: null,
  resolved_by: null,
  resolved_at: null,
  created_at: '2026-04-20T10:00:00Z',
  updated_at: '2026-04-20T10:00:00Z',
}

function makeGetRequest() {
  return new NextRequest(new URL('/api/reports', 'http://localhost'))
}

function makePostRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/reports', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

describe('GET /api/reports', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns own reports on success', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnReports).mockResolvedValue([fakeReport] as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([fakeReport])
  })

  it('scopes reports to reporter id', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnReports).mockResolvedValue([fakeReport] as never)
    await GET(makeGetRequest())
    expect(getOwnReports).toHaveBeenCalledWith(expect.anything(), 'user-1')
  })

  it('returns 500 on AdminError', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnReports).mockRejectedValue(new AdminError('REPORTS_FETCH_FAILED', 'db error'))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('REPORTS_FETCH_FAILED')
  })
})

describe('POST /api/reports', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makePostRequest({ reported_user_id: '00000000-0000-4000-8000-000000000002', reason: 'spam' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when reason is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ reported_user_id: '00000000-0000-4000-8000-000000000002' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when no target is provided', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ reason: 'spam' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_TARGET')
  })

  it('returns 201 with created report on success', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockResolvedValue(fakeReport as never)
    const res = await POST(makePostRequest({ reported_user_id: '00000000-0000-4000-8000-000000000002', reason: 'spam' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('report-1')
  })

  it('returns 500 on AdminError', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockRejectedValue(new AdminError('REPORT_CREATE_FAILED', 'insert failed'))
    const res = await POST(makePostRequest({ reported_user_id: '00000000-0000-4000-8000-000000000002', reason: 'spam' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('REPORT_CREATE_FAILED')
  })

  // `reason` is a Postgres enum. Unvalidated it went straight into the insert,
  // and Postgres answered with the raw driver text quoted below, which was
  // handed to the browser as a 500.
  it('returns 400 for a reason outside the enum, before the insert', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockClear()
    const res = await POST(makePostRequest({ reported_user_id: '00000000-0000-4000-8000-000000000002', reason: 'whatever' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_REASON')
    expect(createReport).not.toHaveBeenCalled()
  })

  it.each(['fake_profile', 'inappropriate_content', 'harassment', 'spam', 'underage_concern', 'other'])(
    'accepts the %s reason',
    async (reason) => {
      vi.mocked(getUser).mockResolvedValue(fakeUser as never)
      vi.mocked(createReport).mockResolvedValue(fakeReport as never)
      const res = await POST(makePostRequest({ reported_user_id: '00000000-0000-4000-8000-000000000002', reason }))
      expect(res.status).toBe(201)
    },
  )

  it('returns 400 for a detail longer than REPORT_DETAIL_MAX', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockClear()
    const res = await POST(
      makePostRequest({
        reported_user_id: '00000000-0000-4000-8000-000000000002',
        reason: 'spam',
        detail: 'x'.repeat(REPORT_DETAIL_MAX + 1),
      }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('DETAIL_TOO_LONG')
    expect(createReport).not.toHaveBeenCalled()
  })

  it('accepts a detail exactly at the limit', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockResolvedValue(fakeReport as never)
    const res = await POST(
      makePostRequest({
        reported_user_id: '00000000-0000-4000-8000-000000000002',
        reason: 'spam',
        detail: 'x'.repeat(REPORT_DETAIL_MAX),
      }),
    )
    expect(res.status).toBe(201)
  })

  // The driver message names internal enums, columns and types. It belongs in
  // the server log; the browser gets copy a person can act on.
  it('never sends the raw driver message to the client', async () => {
    const raw = 'invalid input value for enum report_reason: "whatever"'
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockRejectedValue(new AdminError('REPORT_CREATE_FAILED', raw))
    const res = await POST(makePostRequest({ reported_user_id: '00000000-0000-4000-8000-000000000002', reason: 'spam' }))
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('report_reason')
    expect(body.error.message).not.toBe(raw)
    expect(body.error.message.length).toBeGreaterThan(0)
  })

  it('never sends the raw driver message on a failed fetch either', async () => {
    const raw = 'column reports.reporter_id does not exist'
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnReports).mockRejectedValue(new AdminError('REPORTS_FETCH_FAILED', raw))
    const res = await GET(makeGetRequest())
    expect((await res.json()).error.message).not.toBe(raw)
  })

  // D18: a user must not be able to report themselves; unchecked, the FK was
  // valid so it inserted and filled the queue.
  it('rejects a self-report before the insert', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockClear()
    const res = await POST(makePostRequest({ reported_user_id: 'user-1', reason: 'spam' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('SELF_REPORT')
    expect(createReport).not.toHaveBeenCalled()
  })

  // D18: a non-UUID id reached Postgres as 22P02 and returned raw text as a 500.
  it('rejects a non-UUID target with a 400', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockClear()
    const res = await POST(makePostRequest({ reported_user_id: 'not-a-uuid', reason: 'spam' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_TARGET')
    expect(createReport).not.toHaveBeenCalled()
  })

  it('accepts a valid UUID target', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockResolvedValue(fakeReport as never)
    const res = await POST(
      makePostRequest({ reported_user_id: '11111111-1111-4111-8111-111111111111', reason: 'spam' }),
    )
    expect(res.status).toBe(201)
  })

  // D18: a duplicate open report is a 409, not a 500.
  it('maps a duplicate report to 409 with a user-safe message', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockRejectedValue(
      new AdminError('DUPLICATE_REPORT', 'You have already reported this. Our team is reviewing it.'),
    )
    const res = await POST(
      makePostRequest({ reported_user_id: '22222222-2222-4222-8222-222222222222', reason: 'spam' }),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('DUPLICATE_REPORT')
    expect(body.error.message.length).toBeGreaterThan(0)
  })

  // D18: an unknown target (FK violation) is a 404, not a 500.
  it('maps an unknown target to 404', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockRejectedValue(
      new AdminError('REPORT_TARGET_NOT_FOUND', 'The person or message you reported no longer exists'),
    )
    const res = await POST(
      makePostRequest({ reported_user_id: '33333333-3333-4333-8333-333333333333', reason: 'spam' }),
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('REPORT_TARGET_NOT_FOUND')
  })

  // AK12: a malformed body must be a 400 JSON envelope, not a thrown HTML 500.
  it('returns 400 on malformed JSON', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const req = new NextRequest(new URL('/api/reports', 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_JSON')
  })
})
