import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/discovery')>()
  return { ...actual, getBlocks: vi.fn(), blockUser: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getBlocks, blockUser, DiscoveryError } from '@/lib/supabase/discovery'
import { GET, POST } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/discovery/blocks', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('GET /api/discovery/blocks', () => {
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

  it('returns 200 with blocks on success', async () => {
    const fakeBlocks = [{ id: 'b1', blocker_id: 'user-1', blocked_id: 'u2' }]
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getBlocks).mockResolvedValue(fakeBlocks as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeBlocks)
  })
})

describe('POST /api/discovery/blocks', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ blocked_id: 'u2' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when blocked_id is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 409 when user is already blocked', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(blockUser).mockRejectedValue(
      new DiscoveryError('ALREADY_BLOCKED', 'Already blocked')
    )
    const res = await POST(makeRequest({ blocked_id: 'u2' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('ALREADY_BLOCKED')
  })

  it('returns 201 with block entry on success', async () => {
    const fakeBlock = { id: 'b1', blocker_id: 'user-1', blocked_id: 'u2' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(blockUser).mockResolvedValue(fakeBlock as never)
    const res = await POST(makeRequest({ blocked_id: 'u2' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeBlock)
  })
})
