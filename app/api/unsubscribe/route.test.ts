import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/settings', () => ({
  unsubscribeFromAllEmail: vi.fn(),
  updateSettings: vi.fn(),
}))
vi.mock('@/lib/supabase/email', () => ({ addSuppression: vi.fn(), getUserEmail: vi.fn() }))
vi.mock('@/lib/email/unsubscribe', () => ({ verifyUnsubscribeToken: vi.fn() }))
vi.mock('@/lib/observability', () => ({ captureException: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'
import { unsubscribeFromAllEmail, updateSettings } from '@/lib/supabase/settings'
import { addSuppression, getUserEmail } from '@/lib/supabase/email'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'
import { GET, POST } from './route'

function makeRequest(token?: string) {
  const url = token
    ? new URL(`/api/unsubscribe?token=${token}`, 'http://localhost')
    : new URL('/api/unsubscribe', 'http://localhost')
  return new NextRequest(url, { method: 'GET' })
}

describe('/api/unsubscribe — D24 (marketing vs all)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    vi.mocked(getUserEmail).mockResolvedValue('user@example.com')
  })

  it('a marketing unsubscribe only clears marketing_opt_in — never suppresses transactional mail', async () => {
    vi.mocked(verifyUnsubscribeToken).mockReturnValue({ userId: 'u1', purpose: 'marketing' })
    const res = await GET(makeRequest('tok'))
    expect(res.status).toBe(307) // redirect to /unsubscribed (success)
    expect(updateSettings).toHaveBeenCalledWith(expect.anything(), 'u1', { marketing_opt_in: false })
    // The two blunt instruments that would also kill transactional mail must NOT run.
    expect(unsubscribeFromAllEmail).not.toHaveBeenCalled()
    expect(addSuppression).not.toHaveBeenCalled()
  })

  it('an all unsubscribe turns everything off and suppresses the address', async () => {
    vi.mocked(verifyUnsubscribeToken).mockReturnValue({ userId: 'u1', purpose: 'all' })
    await POST(makeRequest('tok'))
    expect(unsubscribeFromAllEmail).toHaveBeenCalledWith(expect.anything(), 'u1')
    expect(addSuppression).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'user@example.com', reason: 'unsubscribe' })
    )
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('a forged/invalid token is refused', async () => {
    vi.mocked(verifyUnsubscribeToken).mockReturnValue(null)
    const res = await POST(makeRequest('bad'))
    expect(res.status).toBe(400)
    expect(updateSettings).not.toHaveBeenCalled()
    expect(unsubscribeFromAllEmail).not.toHaveBeenCalled()
  })
})
