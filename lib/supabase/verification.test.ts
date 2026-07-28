import { describe, it, expect, vi } from 'vitest'
import {
  requestVerification,
  reviewVerification,
  isVerified,
  VerificationError,
} from './verification'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function makeClient() {
  const singleQueue: Array<{ data: unknown; error: unknown }> = []
  const updates: Array<Record<string, unknown>> = []
  const inserts: Array<Record<string, unknown>> = []

  const builder: Record<string, unknown> = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      inserts.push(payload)
      return builder
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload)
      return builder
    }),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(singleQueue.shift() ?? { data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(singleQueue.shift() ?? { data: null, error: null })),
  }

  return {
    client: { from: vi.fn(() => builder) } as unknown as SupabaseClient<Database>,
    updates,
    inserts,
    queueSingle: (data: unknown, error: unknown = null) => singleQueue.push({ data, error }),
  }
}

describe('requestVerification', () => {
  it('inserts a pending request for the user and role', async () => {
    const m = makeClient()
    m.queueSingle({ id: 'v1', user_id: 'u1', role: 'athlete', status: 'pending' })
    const row = await requestVerification(m.client, 'u1', 'athlete', 'please verify')
    expect(row.status).toBe('pending')
    expect(m.inserts[0]).toMatchObject({ user_id: 'u1', role: 'athlete', note: 'please verify' })
  })

  it('maps the unique-violation to ALREADY_PENDING', async () => {
    const m = makeClient()
    m.queueSingle(null, { code: '23505', message: 'duplicate' })
    await expect(requestVerification(m.client, 'u1', 'athlete')).rejects.toMatchObject({
      code: 'ALREADY_PENDING',
    })
  })
})

describe('reviewVerification', () => {
  it('approves a request, stamping reviewer and time', async () => {
    const m = makeClient()
    m.queueSingle({ id: 'v1', status: 'approved' })
    const row = await reviewVerification(m.client, 'v1', 'admin-1', 'approve')
    expect(row.status).toBe('approved')
    expect(m.updates[0]).toMatchObject({ status: 'approved', reviewed_by: 'admin-1' })
    expect(m.updates[0]!.reviewed_at).toBeTruthy()
  })

  it('rejects a request', async () => {
    const m = makeClient()
    m.queueSingle({ id: 'v1', status: 'rejected' })
    await reviewVerification(m.client, 'v1', 'admin-1', 'reject')
    expect(m.updates[0]!.status).toBe('rejected')
  })
})

describe('isVerified', () => {
  it('is true when an approved row exists', async () => {
    const m = makeClient()
    m.queueSingle({ id: 'v1' })
    expect(await isVerified(m.client, 'u1')).toBe(true)
  })

  it('is false when none exists', async () => {
    const m = makeClient()
    m.queueSingle(null)
    expect(await isVerified(m.client, 'u1')).toBe(false)
  })
})

describe('VerificationError', () => {
  it('carries a code', () => {
    expect(new VerificationError('X', 'y').code).toBe('X')
  })
})
