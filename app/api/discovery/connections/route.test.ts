import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/discovery')>()
  return { ...actual, sendConnectionRequest: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { sendConnectionRequest, DiscoveryError } from '@/lib/supabase/discovery'
import { POST } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/discovery/connections', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('POST /api/discovery/connections', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ recipient_id: 'u2', message: 'Hello' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when recipient_id or message is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makeRequest({ recipient_id: 'u2' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when message is too long', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendConnectionRequest).mockRejectedValue(
      new DiscoveryError('MESSAGE_TOO_LONG', 'Too long')
    )
    const res = await POST(makeRequest({ recipient_id: 'u2', message: 'a'.repeat(301) }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MESSAGE_TOO_LONG')
  })

  it('returns 409 when duplicate request exists', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendConnectionRequest).mockRejectedValue(
      new DiscoveryError('DUPLICATE_REQUEST', 'Already exists')
    )
    const res = await POST(makeRequest({ recipient_id: 'u2', message: 'Hello' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('DUPLICATE_REQUEST')
  })

  it('returns 201 with created request on success', async () => {
    const fakeRequest = { id: 'cr1', sender_id: 'user-1', recipient_id: 'u2', message: 'Hello' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendConnectionRequest).mockResolvedValue(fakeRequest as never)
    const res = await POST(makeRequest({ recipient_id: 'u2', message: 'Hello' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeRequest)
  })
})
