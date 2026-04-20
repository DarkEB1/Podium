import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  return { ...actual, getAuditLogs: vi.fn(), createAuditLog: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getAuditLogs, createAuditLog, AdminError } from '@/lib/supabase/admin'
import { GET, POST } from './route'

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

const fakeLog = {
  id: 'audit-1',
  actor_id: 'admin-1',
  action: 'user.suspended',
  target_type: 'user',
  target_id: 'user-2',
  metadata: {},
  ip_address: null,
  created_at: '2026-04-20T10:00:00Z',
}

const serviceRoleKey = 'test-service-role-key'

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL('/api/admin/audit-logs', 'http://localhost')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url)
}

function makePostRequest(body?: Record<string, unknown>, authHeader?: string) {
  return new NextRequest(new URL('/api/admin/audit-logs', 'http://localhost'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body ?? {}),
  })
}

describe('GET /api/admin/audit-logs', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createAdminClient).mockReturnValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 when user is not admin', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAthlete as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  it('returns audit logs for admin', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(getAuditLogs).mockResolvedValue([fakeLog] as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([fakeLog])
  })

  it('passes limit and offset from query params', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(getAuditLogs).mockResolvedValue([fakeLog] as never)
    await GET(makeGetRequest({ limit: '10', offset: '20' }))
    expect(getAuditLogs).toHaveBeenCalledWith(expect.anything(), { limit: 10, offset: 20 })
  })

  it('returns 500 on AdminError', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(getAuditLogs).mockRejectedValue(new AdminError('AUDIT_LOGS_FETCH_FAILED', 'db error'))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('AUDIT_LOGS_FETCH_FAILED')
  })
})

describe('POST /api/admin/audit-logs', () => {
  let originalKey: string | undefined

  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
    }
  })

  it('returns 401 when no authorization header', async () => {
    const res = await POST(makePostRequest({ action: 'user.suspended', target_type: 'user', target_id: 'user-2' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 401 when wrong service role key', async () => {
    const res = await POST(makePostRequest({ action: 'user.suspended', target_type: 'user', target_id: 'user-2' }, 'Bearer wrong-key'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makePostRequest({}, `Bearer ${serviceRoleKey}`))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_FIELDS')
  })

  it('returns 201 with created log on success', async () => {
    vi.mocked(createAuditLog).mockResolvedValue(fakeLog as never)
    const res = await POST(makePostRequest(
      { action: 'user.suspended', target_type: 'user', target_id: 'user-2' },
      `Bearer ${serviceRoleKey}`
    ))
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe('audit-1')
  })

  it('returns 500 on AdminError', async () => {
    vi.mocked(createAuditLog).mockRejectedValue(new AdminError('AUDIT_LOG_CREATE_FAILED', 'insert failed'))
    const res = await POST(makePostRequest(
      { action: 'user.suspended', target_type: 'user', target_id: 'user-2' },
      `Bearer ${serviceRoleKey}`
    ))
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('AUDIT_LOG_CREATE_FAILED')
  })
})
