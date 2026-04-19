import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/messaging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/messaging')>()
  return { ...actual, getMessages: vi.fn(), sendMessage: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMessages, sendMessage, MessagingError } from '@/lib/supabase/messaging'
import { GET, POST } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

const params = Promise.resolve({ matchId: 'm1' })

function makeGetRequest() {
  return new NextRequest(
    new URL('/api/messaging/matches/m1/messages', 'http://localhost'),
    { method: 'GET' }
  )
}

function makePostRequest(body?: Record<string, unknown>) {
  return new NextRequest(
    new URL('/api/messaging/matches/m1/messages', 'http://localhost'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }
  )
}

describe('GET /api/messaging/matches/[matchId]/messages', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 200 with messages array on success', async () => {
    const fakeMessages = [{ id: 'msg1', match_id: 'm1', content_type: 'text' }]
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getMessages).mockResolvedValue(fakeMessages as never)
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeMessages)
  })

  it('calls getMessages with matchId', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getMessages).mockResolvedValue([])
    await GET(makeGetRequest(), { params })
    expect(getMessages).toHaveBeenCalledWith(expect.anything(), 'm1')
  })

  it('returns 404 when match not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getMessages).mockRejectedValue(new MessagingError('MATCH_NOT_FOUND', 'Not found'))
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('MATCH_NOT_FOUND')
  })
})

describe('POST /api/messaging/matches/[matchId]/messages', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makePostRequest({ content_type: 'text' }), { params })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when content_type is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({}), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when content_type is invalid', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makePostRequest({ content_type: 'hack' }), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_CONTENT_TYPE')
  })

  it('returns 201 with message on success', async () => {
    const fakeMsg = { id: 'msg1', match_id: 'm1', content_type: 'text', text_content: 'Hi' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendMessage).mockResolvedValue(fakeMsg as never)
    const res = await POST(makePostRequest({ content_type: 'text', text_content: 'Hi' }), { params })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeMsg)
  })

  it('calls sendMessage with matchId, userId, contentType, and payload', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendMessage).mockResolvedValue({} as never)
    await POST(makePostRequest({ content_type: 'text', text_content: 'Hi' }), { params })
    expect(sendMessage).toHaveBeenCalledWith(
      expect.anything(),
      'm1',
      'user-1',
      'text',
      expect.objectContaining({ text_content: 'Hi' })
    )
  })

  it('returns 404 when match not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendMessage).mockRejectedValue(new MessagingError('MATCH_NOT_FOUND', 'Not found'))
    const res = await POST(makePostRequest({ content_type: 'text' }), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('MATCH_NOT_FOUND')
  })

  it('returns 403 when proposal is required', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendMessage).mockRejectedValue(
      new MessagingError('PROPOSAL_REQUIRED', 'Send proposal first')
    )
    const res = await POST(makePostRequest({ content_type: 'text' }), { params })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('PROPOSAL_REQUIRED')
  })
})
