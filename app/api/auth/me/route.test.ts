import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { GET } from './route'

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns only the safe public fields from the user row', async () => {
    const fakeUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'athlete',
      role_locked_at: '2026-04-19T00:00:00Z',
      email_verified: true,
      terms_accepted_at: '2026-04-19T00:00:00Z',
      deactivated_at: null,
      deletion_scheduled_at: null,
      // These fields should NOT appear in the response
      full_legal_name: 'Secret Name',
      phone: '+447700000000',
    }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'athlete',
      role_locked_at: '2026-04-19T00:00:00Z',
      email_verified: true,
      terms_accepted_at: '2026-04-19T00:00:00Z',
      deactivated_at: null,
      deletion_scheduled_at: null,
    })
  })

  it('returns role: null and role_locked_at: null for a new user who has not selected a role', async () => {
    vi.mocked(getUser).mockResolvedValue({
      id: 'user-456',
      email: 'new@example.com',
      role: null,
      role_locked_at: null,
      email_verified: false,
      terms_accepted_at: null,
      deactivated_at: null,
      deletion_scheduled_at: null,
    } as never)

    const res = await GET()
    const json = await res.json()
    expect(json.role).toBeNull()
    expect(json.role_locked_at).toBeNull()
  })
})
