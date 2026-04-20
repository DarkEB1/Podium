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
vi.mock('@/lib/supabase/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/notifications')>()
  return { ...actual, getNotifications: vi.fn(), createNotification: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getNotifications, createNotification, NotificationsError } from '@/lib/supabase/notifications'
import { GET, POST } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'user@test.com',
  role: 'athlete' as const,
  role_locked_at: '2026-04-01T00:00:00Z',
}

const fakeNotifications = [
  {
    id: 'notif-1',
    user_id: 'user-1',
    event_type: 'connection_request_received',
    channel: 'in_app',
    title: 'New connection',
    body: 'Someone wants to connect',
    metadata: {},
    sent_at: '2026-04-20T10:00:00Z',
    read_at: null,
    created_at: '2026-04-20T10:00:00Z',
  },
]

function makeGetRequest() {
  return new NextRequest(new URL('/api/notifications', 'http://localhost'))
}

function makePostRequest(body?: Record<string, unknown>, authHeader?: string) {
  return new NextRequest(new URL('/api/notifications', 'http://localhost'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body ?? {}),
  })
}

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns notifications array on success', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getNotifications).mockResolvedValue(fakeNotifications as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(fakeNotifications)
  })

  it('returns empty array when no notifications', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getNotifications).mockResolvedValue([])
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 500 when lib throws NotificationsError', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getNotifications).mockRejectedValue(new NotificationsError('NOTIFICATIONS_FETCH_FAILED', 'db error'))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('NOTIFICATIONS_FETCH_FAILED')
  })
})

describe('POST /api/notifications', () => {
  const serviceRoleKey = 'test-service-role-key'
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
    const res = await POST(makePostRequest({ user_id: 'user-1', event_type: 'test', channel: 'in_app', title: 'T', body: 'B' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 401 when authorization header is wrong', async () => {
    const res = await POST(makePostRequest({ user_id: 'user-1', event_type: 'test', channel: 'in_app', title: 'T', body: 'B' }, 'Bearer wrong-key'))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makePostRequest({}, `Bearer ${serviceRoleKey}`))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_FIELDS')
  })

  it('returns 201 with created notification on success', async () => {
    const payload = { user_id: 'user-1', event_type: 'payment_received', channel: 'in_app' as const, title: 'Paid', body: 'You got paid' }
    vi.mocked(createNotification).mockResolvedValue({ ...payload, id: 'notif-new', metadata: {}, sent_at: '2026-04-20T10:00:00Z', read_at: null, created_at: '2026-04-20T10:00:00Z' } as never)
    const res = await POST(makePostRequest(payload, `Bearer ${serviceRoleKey}`))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('notif-new')
  })

  it('returns 500 when lib throws NotificationsError', async () => {
    const payload = { user_id: 'user-1', event_type: 'payment_received', channel: 'in_app', title: 'T', body: 'B' }
    vi.mocked(createNotification).mockRejectedValue(new NotificationsError('NOTIFICATION_CREATE_FAILED', 'insert failed'))
    const res = await POST(makePostRequest(payload, `Bearer ${serviceRoleKey}`))
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('NOTIFICATION_CREATE_FAILED')
  })
})
