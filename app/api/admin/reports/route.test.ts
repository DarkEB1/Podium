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
  return { ...actual, getReports: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getReports, AdminError } from '@/lib/supabase/admin'
import { GET } from './route'

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

function makeRequest(params?: Record<string, string>) {
  const url = new URL('/api/admin/reports', 'http://localhost')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url)
}

describe('GET /api/admin/reports', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createAdminClient).mockReturnValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 when user is not admin', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAthlete as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  it('returns all reports for admin', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(getReports).mockResolvedValue([fakeReport] as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([fakeReport])
  })

  it('passes status filter from query param', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(getReports).mockResolvedValue([fakeReport] as never)
    await GET(makeRequest({ status: 'pending' }))
    expect(getReports).toHaveBeenCalledWith(expect.anything(), { status: 'pending' })
  })

  it('returns 500 on AdminError', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(getReports).mockRejectedValue(new AdminError('REPORTS_FETCH_FAILED', 'db error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('REPORTS_FETCH_FAILED')
  })
})
