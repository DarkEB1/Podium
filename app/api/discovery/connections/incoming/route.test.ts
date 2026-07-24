import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/connections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/connections')>()
  return { ...actual, getIncomingConnectionRequests: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getIncomingConnectionRequests, ConnectionsError } from '@/lib/supabase/connections'
import { GET } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

function makeRequest(search = '') {
  return new NextRequest(
    new URL(`/api/discovery/connections/incoming${search}`, 'http://localhost')
  )
}

describe('GET /api/discovery/connections/incoming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
    vi.mocked(getIncomingConnectionRequests).mockResolvedValue([])
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns the signed-in user’s incoming requests', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getIncomingConnectionRequests).mockResolvedValue([
      { id: 'cr1' },
      { id: 'cr2' },
    ] as never)

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.count).toBe(2)
    expect(json.requests).toHaveLength(2)
  })

  it('always scopes to the authenticated user, never to a supplied id', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)

    await GET(makeRequest('?recipient_id=someone-else&user_id=someone-else'))

    expect(getIncomingConnectionRequests).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.anything()
    )
  })

  it('passes a valid status filter through', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)

    await GET(makeRequest('?status=accepted'))

    expect(getIncomingConnectionRequests).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ status: 'accepted' })
    )
  })

  it('rejects an unknown status with 400', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)

    const res = await GET(makeRequest('?status=bogus'))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_STATUS')
  })

  it('caps the limit at 100', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)

    await GET(makeRequest('?limit=5000'))

    expect(getIncomingConnectionRequests).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ limit: 100 })
    )
  })

  it('returns a generic 500 and never echoes the DB message', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getIncomingConnectionRequests).mockRejectedValue(
      new ConnectionsError('INCOMING_REQUESTS_FETCH_FAILED', 'relation does not exist')
    )

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('INCOMING_REQUESTS_FETCH_FAILED')
    expect(JSON.stringify(json)).not.toContain('relation does not exist')
  })

  it('reports the failure to observability as structured JSON', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getIncomingConnectionRequests).mockRejectedValue(new Error('boom'))

    await GET(makeRequest())

    // console.error is the zero-dependency sink; the line must be parseable.
    const spy = vi.mocked(console.error)
    expect(spy).toHaveBeenCalled()
    const record = JSON.parse(String(spy.mock.calls[0]?.[0])) as {
      level: string
      context: Record<string, unknown>
    }
    expect(record.level).toBe('error')
    expect(record.context.route).toBe('/api/discovery/connections/incoming')
  })
})
