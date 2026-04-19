import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/profiles')>()
  return { ...actual, publishProfile: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { publishProfile, ProfileError } from '@/lib/supabase/profiles'
import { POST } from './route'

describe('POST /api/profiles/me/publish', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when role is not set', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: null, role_locked_at: null } as never)
    const res = await POST()
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('ROLE_NOT_SET')
  })

  it('returns 400 with BRAND_NOT_PUBLISHABLE for brand accounts', async () => {
    vi.mocked(getUser).mockResolvedValue({
      id: 'u1',
      role: 'brand',
      role_locked_at: '2026-04-19T00:00:00Z',
    } as never)
    vi.mocked(publishProfile).mockRejectedValue(
      new ProfileError('BRAND_NOT_PUBLISHABLE', 'Requires admin approval')
    )
    const res = await POST()
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('BRAND_NOT_PUBLISHABLE')
  })

  it('returns 404 when profile has not been created yet', async () => {
    vi.mocked(getUser).mockResolvedValue({
      id: 'u1',
      role: 'athlete',
      role_locked_at: '2026-04-19T00:00:00Z',
    } as never)
    vi.mocked(publishProfile).mockRejectedValue(
      new ProfileError('PROFILE_NOT_FOUND', 'No profile found')
    )
    const res = await POST()
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROFILE_NOT_FOUND')
  })

  it('returns 200 with success: true when profile is published', async () => {
    vi.mocked(getUser).mockResolvedValue({
      id: 'u1',
      role: 'athlete',
      role_locked_at: '2026-04-19T00:00:00Z',
    } as never)
    vi.mocked(publishProfile).mockResolvedValue(undefined)
    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
