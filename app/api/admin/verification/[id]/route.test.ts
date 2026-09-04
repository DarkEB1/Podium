import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/verification', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/verification')>()
  return { ...actual, reviewVerification: vi.fn() }
})
vi.mock('@/lib/supabase/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/admin')>()
  return { ...actual, createAuditLog: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { reviewVerification, VerificationError } from '@/lib/supabase/verification'
import { createAuditLog } from '@/lib/supabase/admin'
import { POST } from './route'

const fakeAdmin = { id: 'admin-1', email: 'admin@podium.com', role: 'admin' as const, role_locked_at: '2026-01-01T00:00:00Z' }

function makeReq(body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/admin/verification/v-1', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}
const routeParams = { params: Promise.resolve({ id: 'v-1' }) }

describe('POST /api/admin/verification/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    vi.mocked(createAuditLog).mockResolvedValue({} as never)
  })

  it('writes an audit log carrying the review note', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(reviewVerification).mockResolvedValue({ status: 'approved' } as never)
    const res = await POST(makeReq({ action: 'approve', note: 'passport checked' }), routeParams)
    expect(res.status).toBe(200)
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actor_id: 'admin-1',
        action: 'verification_approve',
        target_type: 'verification_request',
        target_id: 'v-1',
        metadata: expect.objectContaining({ status: 'approved', note: 'passport checked' }),
      }),
    )
  })

  it('sanitizes a raw driver error rather than leaking it', async () => {
    const raw = 'relation "verification_requests" does not exist'
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(reviewVerification).mockRejectedValue(new VerificationError('REVIEW_FAILED', raw))
    const res = await POST(makeReq({ action: 'reject' }), routeParams)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.message).not.toBe(raw)
    expect(JSON.stringify(body)).not.toContain('verification_requests')
  })
})
