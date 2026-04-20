import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/notifications')>()
  return { ...actual, markRead: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { markRead, NotificationsError } from '@/lib/supabase/notifications'
import { PATCH } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'user@test.com',
  role: 'athlete' as const,
  role_locked_at: '2026-04-01T00:00:00Z',
}

const updatedNotification = {
  id: 'notif-1',
  user_id: 'user-1',
  event_type: 'connection_request_received',
  channel: 'in_app',
  title: 'New connection',
  body: 'Someone wants to connect',
  metadata: {},
  sent_at: '2026-04-20T10:00:00Z',
  read_at: '2026-04-20T11:00:00Z',
  created_at: '2026-04-20T10:00:00Z',
}

function makeRequest(id: string) {
  return new NextRequest(new URL(`/api/notifications/${id}/read`, 'http://localhost'), {
    method: 'PATCH',
  })
}

describe('PATCH /api/notifications/[id]/read', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createAdminClient).mockReturnValue({} as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest('notif-1'), { params: Promise.resolve({ id: 'notif-1' }) })
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns updated notification on success', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(markRead).mockResolvedValue(updatedNotification as never)
    const res = await PATCH(makeRequest('notif-1'), { params: Promise.resolve({ id: 'notif-1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.read_at).not.toBeNull()
  })

  it('returns 404 when notification not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(markRead).mockRejectedValue(new NotificationsError('NOTIFICATION_NOT_FOUND', 'not found'))
    const res = await PATCH(makeRequest('bad-id'), { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOTIFICATION_NOT_FOUND')
  })
})
