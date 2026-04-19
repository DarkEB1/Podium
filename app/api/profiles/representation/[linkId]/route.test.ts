import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/profiles')>()
  return { ...actual, respondRepresentationLink: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { respondRepresentationLink, ProfileError } from '@/lib/supabase/profiles'
import { PATCH } from './route'

function makeRequest(linkId: string, body?: Record<string, unknown>) {
  return new NextRequest(new URL(`/api/profiles/representation/${linkId}`, 'http://localhost'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('PATCH /api/profiles/representation/[linkId]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest('link-1', { accept: true }), {
      params: Promise.resolve({ linkId: 'link-1' }),
    })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when accept field is missing', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'athlete' } as never)
    const res = await PATCH(makeRequest('link-1', {}), {
      params: Promise.resolve({ linkId: 'link-1' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 200 with success: true when accepting', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'athlete' } as never)
    vi.mocked(respondRepresentationLink).mockResolvedValue(undefined)
    const res = await PATCH(makeRequest('link-1', { accept: true }), {
      params: Promise.resolve({ linkId: 'link-1' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 200 with success: true when declining', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'athlete' } as never)
    vi.mocked(respondRepresentationLink).mockResolvedValue(undefined)
    const res = await PATCH(makeRequest('link-1', { accept: false }), {
      params: Promise.resolve({ linkId: 'link-1' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 404 when link does not exist', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'athlete' } as never)
    vi.mocked(respondRepresentationLink).mockRejectedValue(
      new ProfileError('LINK_NOT_FOUND', 'Not found')
    )
    const res = await PATCH(makeRequest('bad-link', { accept: true }), {
      params: Promise.resolve({ linkId: 'bad-link' }),
    })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('LINK_NOT_FOUND')
  })

  it('calls respondRepresentationLink with linkId, userId, and accept value', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'athlete' } as never)
    vi.mocked(respondRepresentationLink).mockResolvedValue(undefined)
    await PATCH(makeRequest('link-1', { accept: true }), {
      params: Promise.resolve({ linkId: 'link-1' }),
    })
    expect(respondRepresentationLink).toHaveBeenCalledWith(
      expect.anything(),
      'link-1',
      'u1',
      true
    )
  })
})
