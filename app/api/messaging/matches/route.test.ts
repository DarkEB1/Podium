import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/messaging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/messaging')>()
  return { ...actual, getMatches: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMatches } from '@/lib/supabase/messaging'
import { GET } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

describe('GET /api/messaging/matches', () => {
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

  it('returns 200 with matches array on success', async () => {
    const fakeMatches = [{ id: 'm1', user_a_id: 'user-1', user_b_id: 'u2', status: 'active' }]
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getMatches).mockResolvedValue(fakeMatches as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeMatches)
  })

  it('calls getMatches with the authenticated user id', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getMatches).mockResolvedValue([])
    await GET()
    expect(getMatches).toHaveBeenCalledWith(expect.anything(), 'user-1')
  })
})
