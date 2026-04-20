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
  reported_user_id: 'user-2',
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
    const res = await POST(makePostRequest({ reported_user_id: 'user-2', reason: 'spam' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when reason is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ reported_user_id: 'user-2' }))
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
    const res = await POST(makePostRequest({ reported_user_id: 'user-2', reason: 'spam' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('report-1')
  })

  it('returns 500 on AdminError', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createReport).mockRejectedValue(new AdminError('REPORT_CREATE_FAILED', 'insert failed'))
    const res = await POST(makePostRequest({ reported_user_id: 'user-2', reason: 'spam' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('REPORT_CREATE_FAILED')
  })
})
