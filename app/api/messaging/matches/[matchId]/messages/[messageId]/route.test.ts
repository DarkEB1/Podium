import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/messaging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/messaging')>()
  return { ...actual, deleteMessage: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { deleteMessage, MessagingError } from '@/lib/supabase/messaging'
import { DELETE } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'athlete' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

const params = Promise.resolve({ matchId: 'm1', messageId: 'msg1' })

function makeRequest() {
  return new NextRequest(
    new URL('/api/messaging/matches/m1/messages/msg1', 'http://localhost'),
    { method: 'DELETE' }
  )
}

describe('DELETE /api/messaging/matches/[matchId]/messages/[messageId]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), { params })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 200 with success on soft-delete', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(deleteMessage).mockResolvedValue(undefined)
    const res = await DELETE(makeRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('calls deleteMessage with messageId and userId', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(deleteMessage).mockResolvedValue(undefined)
    await DELETE(makeRequest(), { params })
    expect(deleteMessage).toHaveBeenCalledWith(expect.anything(), 'msg1', 'user-1')
  })

  it('returns 404 when message not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(deleteMessage).mockRejectedValue(
      new MessagingError('MESSAGE_NOT_FOUND', 'Not found')
    )
    const res = await DELETE(makeRequest(), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('MESSAGE_NOT_FOUND')
  })
})
