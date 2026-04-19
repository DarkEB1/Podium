import { describe, it, expect, vi, beforeEach } from 'vitest'
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
})

// ---------------------------------------------------------------------------
// lockRole
// ---------------------------------------------------------------------------

describe('lockRole', () => {
  it('throws AuthError with ROLE_ALREADY_LOCKED when role is already set', async () => {
    const { client, mocks } = makeMockClient()
    mocks.mockSingle.mockResolvedValue({
      data: { role_locked_at: '2026-01-01T00:00:00Z' },
      error: null,
    })

    await expect(lockRole(client, 'user-123', 'athlete')).rejects.toThrow(AuthError)
    await expect(lockRole(client, 'user-123', 'athlete')).rejects.toMatchObject({
      code: 'ROLE_ALREADY_LOCKED',
    })
  })

  it('calls update with role and role_locked_at when not yet locked', async () => {
    const { client, mocks } = makeMockClient()
    // First call: select to check lock status
    mocks.mockSingle.mockResolvedValueOnce({ data: { role_locked_at: null }, error: null })
    // Update chain uses its own eq — override update only
    mocks.mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    await lockRole(client, 'user-123', 'brand')

    expect(mocks.mockFrom).toHaveBeenCalledWith('users')
    expect(mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'brand' })
    )
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

    const [[updateArg]] = mocks.mockUpdate.mock.calls
    const requestedAt = new Date(updateArg.deletion_requested_at)
    const scheduledAt = new Date(updateArg.deletion_scheduled_at)

    expect(requestedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(requestedAt.getTime()).toBeLessThanOrEqual(after.getTime())

    const diffDays = (scheduledAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(14, 0)
  })
})
