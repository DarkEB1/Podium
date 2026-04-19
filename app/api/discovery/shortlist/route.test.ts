import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/discovery')>()
  return { ...actual, getShortlist: vi.fn(), addToShortlist: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getShortlist, addToShortlist, DiscoveryError } from '@/lib/supabase/discovery'
import { GET, POST } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/discovery/shortlist', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('GET /api/discovery/shortlist', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 200 with shortlist on success', async () => {
    const fakeShortlist = [{ id: 's1', user_id: 'user-1', target_user_id: 'u2' }]
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getShortlist).mockResolvedValue(fakeShortlist as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeShortlist)
  })
})

describe('POST /api/discovery/shortlist', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ target_user_id: 'u2' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when target_user_id is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 409 when already shortlisted', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(addToShortlist).mockRejectedValue(
      new DiscoveryError('ALREADY_SHORTLISTED', 'Already shortlisted')
    )
    const res = await POST(makeRequest({ target_user_id: 'u2' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('ALREADY_SHORTLISTED')
  })

  it('returns 201 with shortlist entry on success', async () => {
    const fakeEntry = { id: 's1', user_id: 'user-1', target_user_id: 'u2' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(addToShortlist).mockResolvedValue(fakeEntry as never)
    const res = await POST(makeRequest({ target_user_id: 'u2' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeEntry)
  })
})
