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
  return { ...actual, getReport: vi.fn(), resolveReport: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getReport, resolveReport, AdminError } from '@/lib/supabase/admin'
import { GET, PATCH } from './route'

const fakeAdmin = {
  id: 'admin-1',
  email: 'admin@podium.com',
  role: 'admin' as const,
  role_locked_at: '2026-01-01T00:00:00Z',
}

const fakeAthlete = {
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
  return new NextRequest(new URL('/api/admin/reports/report-1', 'http://localhost'))
}

function makePatchRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/admin/reports/report-1', 'http://localhost'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

const routeParams = { params: Promise.resolve({ id: 'report-1' }) }

describe('GET /api/admin/reports/[id]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createAdminClient).mockReturnValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), routeParams)
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 when user is not admin', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAthlete as never)
    const res = await GET(makeGetRequest(), routeParams)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  it('returns report for admin', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(getReport).mockResolvedValue(fakeReport as never)
    const res = await GET(makeGetRequest(), routeParams)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(fakeReport)
  })

  it('returns 404 on REPORT_NOT_FOUND', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(getReport).mockRejectedValue(new AdminError('REPORT_NOT_FOUND', 'not found'))
    const res = await GET(makeGetRequest(), routeParams)
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('REPORT_NOT_FOUND')
  })

  it('returns 500 on other AdminError', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(getReport).mockRejectedValue(new AdminError('REPORT_FETCH_FAILED', 'db error'))
    const res = await GET(makeGetRequest(), routeParams)
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/admin/reports/[id]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createAdminClient).mockReturnValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await PATCH(makePatchRequest({ status: 'resolved' }), routeParams)
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAthlete as never)
    const res = await PATCH(makePatchRequest({ status: 'resolved' }), routeParams)
    expect(res.status).toBe(403)
  })

  it('returns 400 when status is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    const res = await PATCH(makePatchRequest({}), routeParams)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_FIELDS')
  })

  it('returns resolved report on success', async () => {
    const resolved = { ...fakeReport, status: 'resolved' as const, resolved_by: 'admin-1', resolved_at: '2026-04-20T11:00:00Z' }
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(resolveReport).mockResolvedValue(resolved as never)
    const res = await PATCH(makePatchRequest({ status: 'resolved', admin_notes: 'confirmed' }), routeParams)
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('resolved')
  })

  it('returns 404 on REPORT_NOT_FOUND', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(resolveReport).mockRejectedValue(new AdminError('REPORT_NOT_FOUND', 'not found'))
    const res = await PATCH(makePatchRequest({ status: 'dismissed' }), routeParams)
    expect(res.status).toBe(404)
  })

  it('returns 500 on other AdminError', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(resolveReport).mockRejectedValue(new AdminError('REPORT_UPDATE_FAILED', 'db error'))
    const res = await PATCH(makePatchRequest({ status: 'dismissed' }), routeParams)
    expect(res.status).toBe(500)
  })
})
