import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/profiles')>()
  return {
    ...actual,
    getOwnProfile: vi.fn(),
    createRepresentationLink: vi.fn(),
    getRepresentationLinks: vi.fn(),
  }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile, createRepresentationLink, getRepresentationLinks } from '@/lib/supabase/profiles'
import { GET, POST } from './route'

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/profiles/representation', 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('GET /api/profiles/representation', () => {
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

  it('returns 200 with links array on success', async () => {
    const fakeLinks = [{ id: 'link-1', agent_id: 'agent-p1', client_user_id: 'u1' }]
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'athlete' } as never)
    vi.mocked(getRepresentationLinks).mockResolvedValue(fakeLinks as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeLinks)
  })

  it('returns 200 with empty array when no links', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'athlete' } as never)
    vi.mocked(getRepresentationLinks).mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([])
  })
})

describe('POST /api/profiles/representation', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 when user is not an agent', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'athlete' } as never)
    const res = await POST(
      makeRequest('POST', { client_user_id: 'u2', client_role: 'athlete' })
    )
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'agent' } as never)
    vi.mocked(getOwnProfile).mockResolvedValue({ id: 'agent-p1', user_id: 'u1' } as never)
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 404 when agent has no profile', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'agent' } as never)
    vi.mocked(getOwnProfile).mockResolvedValue(null)
    const res = await POST(
      makeRequest('POST', { client_user_id: 'u2', client_role: 'athlete' })
    )
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('AGENT_PROFILE_NOT_FOUND')
  })

  it('returns 201 with link on success', async () => {
    const fakeLink = { id: 'link-1', agent_id: 'agent-p1', client_user_id: 'u2' }
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'agent' } as never)
    vi.mocked(getOwnProfile).mockResolvedValue({ id: 'agent-p1', user_id: 'u1' } as never)
    vi.mocked(createRepresentationLink).mockResolvedValue(fakeLink as never)
    const res = await POST(
      makeRequest('POST', { client_user_id: 'u2', client_role: 'athlete' })
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeLink)
  })
})
