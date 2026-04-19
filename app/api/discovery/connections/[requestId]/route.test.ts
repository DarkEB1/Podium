import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/discovery')>()
  return { ...actual, respondConnectionRequest: vi.fn(), withdrawConnectionRequest: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { respondConnectionRequest, withdrawConnectionRequest, DiscoveryError } from '@/lib/supabase/discovery'
import { PATCH } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'athlete' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/discovery/connections/cr1', 'http://localhost'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

const params = Promise.resolve({ requestId: 'cr1' })

describe('PATCH /api/discovery/connections/[requestId]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ action: 'accept' }), { params })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when action is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await PATCH(makeRequest({}), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_ACTION')
  })

  it('returns 400 when action is invalid', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await PATCH(makeRequest({ action: 'invalid' }), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_ACTION')
  })

  it('calls respondConnectionRequest with accept=true for action accept', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(respondConnectionRequest).mockResolvedValue(undefined)
    const res = await PATCH(makeRequest({ action: 'accept' }), { params })
    expect(res.status).toBe(200)
    expect(respondConnectionRequest).toHaveBeenCalledWith(expect.anything(), 'cr1', 'user-1', true)
  })

  it('calls respondConnectionRequest with accept=false for action decline', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(respondConnectionRequest).mockResolvedValue(undefined)
    const res = await PATCH(makeRequest({ action: 'decline' }), { params })
    expect(res.status).toBe(200)
    expect(respondConnectionRequest).toHaveBeenCalledWith(expect.anything(), 'cr1', 'user-1', false)
  })

  it('calls withdrawConnectionRequest for action withdraw', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(withdrawConnectionRequest).mockResolvedValue(undefined)
    const res = await PATCH(makeRequest({ action: 'withdraw' }), { params })
    expect(res.status).toBe(200)
    expect(withdrawConnectionRequest).toHaveBeenCalledWith(expect.anything(), 'cr1', 'user-1')
  })

  it('returns 404 when request not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(respondConnectionRequest).mockRejectedValue(
      new DiscoveryError('REQUEST_NOT_FOUND', 'Not found')
    )
    const res = await PATCH(makeRequest({ action: 'accept' }), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('REQUEST_NOT_FOUND')
  })
})
