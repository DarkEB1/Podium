import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/discovery')>()
  return { ...actual, unblockUser: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { unblockUser } from '@/lib/supabase/discovery'
import { DELETE } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

function makeRequest() {
  return new NextRequest(new URL('/api/discovery/blocks/u2', 'http://localhost'), {
    method: 'DELETE',
  })
}

const params = Promise.resolve({ blockedId: 'u2' })

describe('DELETE /api/discovery/blocks/[blockedId]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), { params })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 200 on successful unblock', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(unblockUser).mockResolvedValue(undefined)
    const res = await DELETE(makeRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('calls unblockUser with correct user ids', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(unblockUser).mockResolvedValue(undefined)
    await DELETE(makeRequest(), { params })
    expect(unblockUser).toHaveBeenCalledWith(expect.anything(), 'user-1', 'u2')
  })
})
