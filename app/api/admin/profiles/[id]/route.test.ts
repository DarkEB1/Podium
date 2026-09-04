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
vi.mock('@/lib/supabase/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/admin')>()
  return { ...actual, updateProfileStatus: vi.fn(), createAuditLog: vi.fn() }
})

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { updateProfileStatus, createAuditLog, AdminError } from '@/lib/supabase/admin'
import { PATCH } from './route'

const fakeAdmin = { id: 'admin-1', email: 'admin@podium.com', role: 'admin' as const, role_locked_at: '2026-01-01T00:00:00Z' }
const fakeAthlete = { id: 'user-1', email: 'a@test.com', role: 'athlete' as const, role_locked_at: '2026-04-01T00:00:00Z' }

function makeReq(body?: Record<string, unknown>, raw?: string) {
  return new NextRequest(new URL('/api/admin/profiles/p-1', 'http://localhost'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? JSON.stringify(body ?? {}),
  })
}
const routeParams = { params: Promise.resolve({ id: 'p-1' }) }

describe('PATCH /api/admin/profiles/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    vi.mocked(createAuditLog).mockResolvedValue({} as never)
  })

  it('401 when unauthenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await PATCH(makeReq({ action: 'reject', profile_type: 'athlete' }), routeParams)
    expect(res.status).toBe(401)
  })

  it('403 for a non-admin', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAthlete as never)
    const res = await PATCH(makeReq({ action: 'reject', profile_type: 'athlete' }), routeParams)
    expect(res.status).toBe(403)
  })

  it('400 on malformed JSON (guarded body)', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    const res = await PATCH(makeReq(undefined, '{not json'), routeParams)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_JSON')
  })

  // WS-ADMIN-01: athlete reject must write 'suspended', NOT 'deactivated' (the
  // athlete's own toggle value they could re-publish out of).
  it('rejects an athlete to the suspended status', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(updateProfileStatus).mockResolvedValue(undefined as never)
    const res = await PATCH(makeReq({ action: 'reject', profile_type: 'athlete' }), routeParams)
    expect(res.status).toBe(200)
    expect(updateProfileStatus).toHaveBeenCalledWith(
      expect.anything(),
      'p-1',
      'athlete',
      'suspended',
      'admin-1',
    )
    expect((await res.json()).status).toBe('suspended')
  })

  // WS-ADMIN-01: every admin moderation action writes an audit_logs row, with
  // the reason (previously dropped) preserved.
  it('writes an audit log with the reason', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(updateProfileStatus).mockResolvedValue(undefined as never)
    await PATCH(makeReq({ action: 'reject', profile_type: 'athlete', reason: 'fake account' }), routeParams)
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actor_id: 'admin-1',
        action: 'profile_reject',
        target_type: 'athlete_profile',
        target_id: 'p-1',
        metadata: expect.objectContaining({ status: 'suspended', reason: 'fake account' }),
      }),
    )
  })

  it('still returns 200 when audit logging fails (best-effort)', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(updateProfileStatus).mockResolvedValue(undefined as never)
    vi.mocked(createAuditLog).mockRejectedValue(new Error('log db down'))
    const res = await PATCH(makeReq({ action: 'approve', profile_type: 'brand' }), routeParams)
    expect(res.status).toBe(200)
  })

  // D16: moderating an unknown id was a silent 200; now it is a 404.
  it('404 when the profile does not exist', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(updateProfileStatus).mockRejectedValue(new AdminError('PROFILE_NOT_FOUND', 'Profile not found'))
    const res = await PATCH(makeReq({ action: 'approve', profile_type: 'athlete' }), routeParams)
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('PROFILE_NOT_FOUND')
  })

  // The driver text must never reach the browser.
  it('sanitizes a raw driver error', async () => {
    const raw = 'null value in column "status" of relation "athlete_profiles" violates not-null constraint'
    vi.mocked(getUser).mockResolvedValue(fakeAdmin as never)
    vi.mocked(updateProfileStatus).mockRejectedValue(new AdminError('STATUS_UPDATE_FAILED', raw))
    const res = await PATCH(makeReq({ action: 'approve', profile_type: 'athlete' }), routeParams)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.message).not.toBe(raw)
    expect(JSON.stringify(body)).not.toContain('athlete_profiles')
  })
})
