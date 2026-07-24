import { describe, it, expect, vi } from 'vitest'
import { validatePassword } from './auth'

describe('validatePassword', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const result = validatePassword('Ab1!')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/8/)
  })

  it('rejects passwords without an uppercase letter', () => {
    const result = validatePassword('abcdef1!')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/uppercase/i)
  })

  it('rejects passwords without a number', () => {
    const result = validatePassword('Abcdefg!')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/number/i)
  })

  it('rejects passwords without a symbol', () => {
    const result = validatePassword('Abcdef12')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/symbol/i)
  })

  it('accepts a password meeting all requirements', () => {
    expect(validatePassword('ValidPass1!')).toEqual({ valid: true })
  })

  it('accepts passwords with various symbol characters', () => {
    expect(validatePassword('ValidPass1@').valid).toBe(true)
    expect(validatePassword('ValidPass1#').valid).toBe(true)
    expect(validatePassword('ValidPass1$').valid).toBe(true)
  })
})

import { getUser, lockRole, acceptTerms, requestDeletion, AuthError } from './auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Shared mock Supabase client factory
// ---------------------------------------------------------------------------

function makeMockClient(overrides: Record<string, unknown> = {}) {
  const mockSingle = vi.fn()
  const mockEqChain = { single: mockSingle, eq: vi.fn() }
  mockEqChain.eq.mockReturnValue(mockEqChain)
  const mockEq = vi.fn().mockReturnValue(mockEqChain)
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate })
  const mockGetUser = vi.fn()

  return {
    client: {
      auth: { getUser: mockGetUser },
      from: mockFrom,
      ...overrides,
    } as unknown as SupabaseClient<Database>,
    mocks: { mockSingle, mockEq, mockSelect, mockUpdate, mockFrom, mockGetUser },
  }
}

// ---------------------------------------------------------------------------
// getUser
// ---------------------------------------------------------------------------

describe('getUser', () => {
  it('returns null when no auth session exists', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await getUser(client)
    expect(result).toBeNull()
    expect(mocks.mockFrom).not.toHaveBeenCalled()
  })

  it('returns the public.users row when a session exists', async () => {
    const { client, mocks } = makeMockClient()
    const fakeUser = { id: 'user-123', email: 'test@example.com', role: null }
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    mocks.mockSingle.mockResolvedValue({ data: fakeUser, error: null })
    const result = await getUser(client)
    expect(result).toEqual(fakeUser)
    expect(mocks.mockFrom).toHaveBeenCalledWith('users')
  })

  // SB-9/FA-4: this runs on every authenticated request.
  it('projects explicit columns instead of select(*)', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    mocks.mockSingle.mockResolvedValue({ data: { id: 'user-123' }, error: null })

    await getUser(client)

    const columns = mocks.mockSelect.mock.calls[0]?.[0] as string
    expect(columns).not.toBe('*')
    expect(columns).toContain('id')
    expect(columns).toContain('role')
    // Consent/erasure timestamps have dedicated readers and must stay out.
    expect(columns).not.toContain('privacy_version')
    expect(columns).not.toContain('cookie_prefs')
  })

  // FA-3/NX-6: the React cache() wrapper must be a pure perf change. Outside a
  // request scope React does not memoise, so each call still hits the database
  // and no result can survive into a later (i.e. another user's) call.
  it('does not memoise across calls outside a request scope', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
    mocks.mockSingle.mockResolvedValue({ data: { id: 'user-a' }, error: null })
    expect(await getUser(client)).toEqual({ id: 'user-a' })

    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-b' } } })
    mocks.mockSingle.mockResolvedValue({ data: { id: 'user-b' }, error: null })
    expect(await getUser(client)).toEqual({ id: 'user-b' })

    expect(mocks.mockGetUser).toHaveBeenCalledTimes(2)
    expect(mocks.mockSingle).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// lockRole
// ---------------------------------------------------------------------------

/**
 * L-7 — the "not yet locked" guard must live in the WHERE clause of the UPDATE,
 * not in a TypeScript `if` between a SELECT and an UPDATE. These tests record
 * the *shape* of the statement, because that shape is the whole fix: a mock can
 * never reproduce the concurrency window, but it can prove that no read-then-
 * write pair exists for two racing requests to interleave inside.
 */
function makeLockRoleClient(result: { data: unknown[] | null; error: unknown }) {
  const calls: { table?: string; update?: unknown; eq?: [string, unknown]; is?: [string, unknown]; select?: string } = {}
  const chain = {
    is(column: string, value: unknown) {
      calls.is = [column, value]
      return chain
    },
    eq(column: string, value: unknown) {
      calls.eq = [column, value]
      return chain
    },
    select(columns: string) {
      calls.select = columns
      return Promise.resolve(result)
    },
  }
  const select = vi.fn(() => {
    throw new Error('lockRole must not SELECT before writing — that is the TOCTOU window')
  })
  const client = {
    from: vi.fn((table: string) => {
      calls.table = table
      return {
        select,
        update: (values: unknown) => {
          calls.update = values
          return chain
        },
      }
    }),
    // The mock client is a hand-rolled stand-in for the parts of the PostgREST
    // builder lockRole touches; the full interface is far larger.
  } as unknown as SupabaseClient<Database>

  return { client, calls, select }
}

describe('lockRole (L-7 TOCTOU)', () => {
  it('puts the not-yet-locked guard in the WHERE clause, not in TypeScript', async () => {
    const { client, calls, select } = makeLockRoleClient({ data: [{ id: 'user-123' }], error: null })

    await lockRole(client, 'user-123', 'brand')

    // The single statement is: UPDATE users SET role, role_locked_at
    //                          WHERE id = $2 AND role_locked_at IS NULL
    expect(calls.table).toBe('users')
    expect(calls.update).toEqual(expect.objectContaining({ role: 'brand' }))
    expect(calls.update).toEqual(
      expect.objectContaining({ role_locked_at: expect.any(String) })
    )
    expect(calls.eq).toEqual(['id', 'user-123'])
    expect(calls.is).toEqual(['role_locked_at', null])
    // No preceding read: nothing for a concurrent writer to slip between.
    expect(select).not.toHaveBeenCalled()
  })

  it('treats zero rows affected as ROLE_ALREADY_LOCKED', async () => {
    const { client } = makeLockRoleClient({ data: [], error: null })

    await expect(lockRole(client, 'user-123', 'athlete')).rejects.toThrow(AuthError)
    await expect(lockRole(client, 'user-123', 'athlete')).rejects.toMatchObject({
      code: 'ROLE_ALREADY_LOCKED',
      message: 'Role has already been set and cannot be changed',
    })
  })

  it('is the loser of a race: the second concurrent write matches no rows', async () => {
    // Both callers issue the same conditional UPDATE. Postgres serialises them
    // on the row lock, so exactly one sees a row back.
    const winner = makeLockRoleClient({ data: [{ id: 'user-123' }], error: null })
    const loser = makeLockRoleClient({ data: [], error: null })

    const results = await Promise.allSettled([
      lockRole(winner.client, 'user-123', 'brand'),
      lockRole(loser.client, 'user-123', 'athlete'),
    ])

    expect(results[0].status).toBe('fulfilled')
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: 'ROLE_ALREADY_LOCKED' }),
    })
  })

  it('surfaces a driver error as ROLE_UPDATE_FAILED', async () => {
    const { client } = makeLockRoleClient({ data: null, error: { message: 'nope' } })

    await expect(lockRole(client, 'user-123', 'team')).rejects.toMatchObject({
      code: 'ROLE_UPDATE_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// acceptTerms
// ---------------------------------------------------------------------------

describe('acceptTerms', () => {
  it('updates terms and privacy fields on the users table', async () => {
    const { client, mocks } = makeMockClient()
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    mocks.mockUpdate.mockReturnValue({ eq: mockUpdateEq })

    await acceptTerms(client, 'user-123', 'v1.0', 'v1.0')

    expect(mocks.mockFrom).toHaveBeenCalledWith('users')
    expect(mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        terms_version: 'v1.0',
        privacy_version: 'v1.0',
      })
    )
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-123')
  })
})

// ---------------------------------------------------------------------------
// requestDeletion
// ---------------------------------------------------------------------------

describe('requestDeletion', () => {
  it('sets deletion_requested_at and schedules deletion 14 days later', async () => {
    const { client, mocks } = makeMockClient()
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    mocks.mockUpdate.mockReturnValue({ eq: mockUpdateEq })

    const before = new Date()
    await requestDeletion(client, 'user-123')
    const after = new Date()

    const updateArg = mocks.mockUpdate.mock.calls[0]![0] as Record<string, string>
    const requestedAt = new Date(updateArg['deletion_requested_at']!)
    const scheduledAt = new Date(updateArg['deletion_scheduled_at']!)

    expect(requestedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(requestedAt.getTime()).toBeLessThanOrEqual(after.getTime())

    const diffDays = (scheduledAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(14, 0)
  })
})

// ---------------------------------------------------------------------------
// acceptTerms — version defaults (CL-5)
// ---------------------------------------------------------------------------

import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions'
import {
  cancelDeletion,
  cancelDeletionOnSignIn,
  getPolicyStaleness,
  processScheduledDeletions,
} from './auth'

describe('acceptTerms version defaults (CL-5)', () => {
  it('writes the current constants when no versions are passed', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    await acceptTerms(client, 'user-123')

    expect(mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      })
    )
  })
})

describe('getPolicyStaleness (CL-5)', () => {
  it('reports stale when the stored version is behind', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockSingle.mockResolvedValue({
      data: {
        terms_version: '2020-01-01',
        terms_accepted_at: '2020-01-01T00:00:00Z',
        privacy_version: PRIVACY_VERSION,
        privacy_accepted_at: '2026-07-20T00:00:00Z',
      },
      error: null,
    })

    const result = await getPolicyStaleness(client, 'user-123')
    expect(result.termsStale).toBe(true)
    expect(result.privacyStale).toBe(false)
    expect(result.stale).toBe(true)
  })

  it('reports current when both versions match', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockSingle.mockResolvedValue({
      data: {
        terms_version: TERMS_VERSION,
        terms_accepted_at: '2026-07-20T00:00:00Z',
        privacy_version: PRIVACY_VERSION,
        privacy_accepted_at: '2026-07-20T00:00:00Z',
      },
      error: null,
    })

    expect((await getPolicyStaleness(client, 'user-123')).stale).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Deletion cancellation (DI-4 / CL-3)
// ---------------------------------------------------------------------------

describe('cancelDeletion', () => {
  it('clears both deletion timestamps', async () => {
    const { client, mocks } = makeMockClient()
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    mocks.mockUpdate.mockReturnValue({ eq: mockUpdateEq })

    await cancelDeletion(client, 'user-123')

    expect(mocks.mockUpdate).toHaveBeenCalledWith({
      deletion_requested_at: null,
      deletion_scheduled_at: null,
    })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-123')
  })

  it('surfaces failures as AuthError', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'nope' } }),
    })

    await expect(cancelDeletion(client, 'user-123')).rejects.toMatchObject({
      code: 'DELETION_CANCEL_FAILED',
    })
  })
})

describe('cancelDeletionOnSignIn', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const past = new Date(Date.now() - 60 * 1000).toISOString()

  it('does nothing when no deletion is pending', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockSingle.mockResolvedValue({
      data: { deletion_requested_at: null, deletion_scheduled_at: null },
      error: null,
    })

    expect(await cancelDeletionOnSignIn(client, 'user-123')).toBe(false)
    expect(mocks.mockUpdate).not.toHaveBeenCalled()
  })

  it('withdraws a pending request when signing back in during the grace period', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockSingle.mockResolvedValue({
      data: { deletion_requested_at: past, deletion_scheduled_at: future },
      error: null,
    })
    mocks.mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    expect(await cancelDeletionOnSignIn(client, 'user-123')).toBe(true)
    expect(mocks.mockUpdate).toHaveBeenCalledWith({
      deletion_requested_at: null,
      deletion_scheduled_at: null,
    })
  })

  it('refuses to withdraw once the scheduled time has passed', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockSingle.mockResolvedValue({
      data: { deletion_requested_at: past, deletion_scheduled_at: past },
      error: null,
    })

    expect(await cancelDeletionOnSignIn(client, 'user-123')).toBe(false)
    expect(mocks.mockUpdate).not.toHaveBeenCalled()
  })
})

describe('processScheduledDeletions', () => {
  it('calls the SECURITY DEFINER function with the batch limit', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { processed_at: '2026-07-20T03:00:00Z', erased: 1, failed: 0, results: [] },
      error: null,
    })
    const client = { rpc } as unknown as SupabaseClient<Database>

    const summary = await processScheduledDeletions(client, 50)

    expect(rpc).toHaveBeenCalledWith('process_scheduled_deletions', { p_limit: 50 })
    expect(summary.erased).toBe(1)
  })

  it('throws AuthError when the RPC fails', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }),
    } as unknown as SupabaseClient<Database>

    await expect(processScheduledDeletions(client)).rejects.toMatchObject({
      code: 'ERASURE_JOB_FAILED',
    })
  })
})
