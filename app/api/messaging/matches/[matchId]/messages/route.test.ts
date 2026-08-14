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
vi.mock('@/lib/supabase/entitlements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/entitlements')>()
  return { ...actual, assertCanSendMessage: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMessages, sendMessage, MessagingError } from '@/lib/supabase/messaging'
import { assertCanSendMessage } from '@/lib/supabase/entitlements'
import { CHAT_MESSAGE_MAX } from '@/lib/limits'
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
    vi.mocked(assertCanSendMessage).mockResolvedValue({
      allowed: true, gated: true, tier: 1, limit: 100, used: 0,
    })
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

  // SEC-3: these are system card types. Nothing server-side creates them, and
  // the chat renders them as authoritative status cards, so a participant who
  // could post one could forge a payment receipt to their counterparty.
  it.each(['proposal_card', 'esignature_request', 'payment_confirmation'])(
    'refuses the system content type %s',
    async (contentType) => {
      vi.mocked(getUser).mockResolvedValue(fakeUser as never)
      vi.mocked(sendMessage).mockClear()
      const res = await POST(
        makePostRequest({ content_type: contentType, metadata: { proposal_id: 'p1' } }),
        { params }
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error.code).toBe('INVALID_CONTENT_TYPE')
      expect(sendMessage).not.toHaveBeenCalled()
    }
  )

  it('refuses client-supplied metadata even on an allowed content type', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendMessage).mockClear()
    const res = await POST(
      makePostRequest({ content_type: 'text', text_content: 'Hi', metadata: { proposal_id: 'p1' } }),
      { params }
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('METADATA_NOT_ALLOWED')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  // SEC-4: CHAT_MESSAGE_MAX was defined in lib/limits.ts but never imported,
  // and the table has no CHECK, so text_content was unbounded.
  it('refuses a message longer than CHAT_MESSAGE_MAX', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendMessage).mockClear()
    const res = await POST(
      makePostRequest({ content_type: 'text', text_content: 'x'.repeat(CHAT_MESSAGE_MAX + 1) }),
      { params }
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MESSAGE_TOO_LONG')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('accepts a message exactly at the limit', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendMessage).mockResolvedValue({ id: 'msg1' } as never)
    const res = await POST(
      makePostRequest({ content_type: 'text', text_content: 'x'.repeat(CHAT_MESSAGE_MAX) }),
      { params }
    )
    expect(res.status).toBe(201)
  })

  it('returns 201 with message on success', async () => {
    const fakeMsg = { id: 'msg1', match_id: 'm1', content_type: 'text', text_content: 'Hi' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendMessage).mockResolvedValue(fakeMsg as never)
    const res = await POST(makePostRequest({ content_type: 'text', text_content: 'Hi' }), { params })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeMsg)
    // Guards against arg-order regressions (e.g. swapping id/role) that every
    // other test's permissive default mock would silently pass through.
    expect(assertCanSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      fakeUser.id,
      fakeUser.role
    )
  })

  it('returns 402 when a Starter brand has hit its monthly message cap', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(assertCanSendMessage).mockResolvedValue({
      allowed: false, gated: true, tier: 1, limit: 100, used: 100, reason: 'LIMIT_REACHED',
    })
    vi.mocked(sendMessage).mockClear()
    const res = await POST(
      makePostRequest({ content_type: 'text', text_content: 'hello' }),
      { params }
    )
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error.code).toBe('LIMIT_REACHED')
    expect(json.limit).toBe(100)
    expect(json.used).toBe(100)
    expect(json.tier).toBe(1)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('returns 402 with SUBSCRIPTION_REQUIRED when the brand has no active subscription', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(assertCanSendMessage).mockResolvedValue({
      allowed: false, gated: true, tier: null, limit: null, used: 0, reason: 'NO_SUBSCRIPTION',
    })
    const res = await POST(
      makePostRequest({ content_type: 'text', text_content: 'hello' }),
      { params }
    )
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error.code).toBe('SUBSCRIPTION_REQUIRED')
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
