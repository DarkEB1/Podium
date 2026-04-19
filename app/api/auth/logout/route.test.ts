import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

describe('POST /api/auth/logout', () => {
  const mockSignOut = vi.fn()

  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { signOut: mockSignOut },
    } as ReturnType<Awaited<typeof createClient>>)
    mockSignOut.mockResolvedValue({ error: null })
  })

  it('calls signOut and returns success', async () => {
    const res = await POST()
    expect(mockSignOut).toHaveBeenCalled()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
