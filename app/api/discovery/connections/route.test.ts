import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/discovery')>()
  return { ...actual, sendConnectionRequest: vi.fn() }
})
vi.mock('@/lib/email', () => ({ sendTransactionalEmail: vi.fn() }))
vi.mock('@/lib/email/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/notify')>()
  return { ...actual, resolveDisplayNames: vi.fn() }
})
vi.mock('@/lib/supabase/entitlements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/entitlements')>()
  return { ...actual, assertCanSendConnectionRequest: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { sendConnectionRequest, DiscoveryError } from '@/lib/supabase/discovery'
import { sendTransactionalEmail } from '@/lib/email'
import { resolveDisplayNames } from '@/lib/email/notify'
import { assertCanSendConnectionRequest } from '@/lib/supabase/entitlements'
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
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
    vi.mocked(createAdminClient).mockReturnValue({} as unknown as ReturnType<typeof createAdminClient>)
    vi.mocked(resolveDisplayNames).mockResolvedValue({ u2: 'Acme Co', 'user-1': 'Jordan Athlete' })
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      status: 'sent',
      deliveryId: 'd1',
      providerId: 'p1',
    })
    vi.mocked(assertCanSendConnectionRequest).mockResolvedValue({
      allowed: true,
      gated: false,
      tier: null,
      limit: null,
      used: 0,
    })
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

  it('emails the recipient a connection_request_received on success', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendConnectionRequest).mockResolvedValue(
      { id: 'cr1', sender_id: 'user-1', recipient_id: 'u2', message: 'Hello' } as never
    )
    await POST(makeRequest({ recipient_id: 'u2', message: 'Hello' }))
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'connection_request_received',
        userId: 'u2',
        data: expect.objectContaining({
          recipientName: 'Acme Co',
          senderName: 'Jordan Athlete',
          message: 'Hello',
        }),
      })
    )
  })

  it('does NOT email when sendConnectionRequest fails', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(sendConnectionRequest).mockRejectedValue(
      new DiscoveryError('DUPLICATE_REQUEST', 'Already exists')
    )
    const res = await POST(makeRequest({ recipient_id: 'u2', message: 'Hello' }))
    expect(res.status).toBe(409)
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('returns 402 when the brand has hit its request cap', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(assertCanSendConnectionRequest).mockResolvedValue({
      allowed: false,
      gated: true,
      tier: 1,
      limit: 15,
      used: 15,
      reason: 'LIMIT_REACHED',
    })
    const res = await POST(makeRequest({ recipient_id: 'u2', message: 'hi there friend' }))
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error.code).toBe('LIMIT_REACHED')
  })

  it('proceeds when under the cap', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(assertCanSendConnectionRequest).mockResolvedValue({
      allowed: true,
      gated: true,
      tier: 1,
      limit: 15,
      used: 3,
    })
    // existing send mock resolves a row so we can assert we did NOT short-circuit at 402
    vi.mocked(sendConnectionRequest).mockResolvedValue(
      { id: 'cr1', sender_id: 'user-1', recipient_id: 'u2', message: 'hi there friend' } as never
    )
    const res = await POST(makeRequest({ recipient_id: 'u2', message: 'hi there friend' }))
    expect(res.status).not.toBe(402)
  })
})
