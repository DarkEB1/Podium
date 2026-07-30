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
  // Same updates, tagged with the table they were issued against, so a test can
  // assert that an approval also wrote to agent_profiles.
  const writes: Array<{ table: string; payload: Record<string, unknown> }> = []
  let table = ''

  const builder: Record<string, unknown> = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      inserts.push(payload)
      return builder
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload)
      writes.push({ table, payload })
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
    client: {
      from: vi.fn((t: string) => {
        table = t
        return builder
      }),
    } as unknown as SupabaseClient<Database>,
    updates,
    inserts,
    writes,
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

  it('marks an approved agent verified on their own profile', async () => {
    // QA-3.1: agents are the one role carrying verification on the profile
    // (agent_profiles.verification_status, rendered by the agent profile and
    // settings screens). An approval that only touched verification_requests
    // left those screens saying "unverified" forever.
    const m = makeClient()
    m.queueSingle({ id: 'v1', user_id: 'agent-1', role: 'agent', status: 'approved' })
    await reviewVerification(m.client, 'v1', 'admin-1', 'approve')

    const profileWrite = m.writes.find((w) => w.table === 'agent_profiles')
    expect(profileWrite?.payload).toMatchObject({
      verification_status: 'verified',
      is_verified: true,
    })
    expect(profileWrite?.payload.verified_at).toBeTruthy()
  })

  it('returns a rejected agent to unverified, not to a non-existent state', async () => {
    // agent_verification_status is unverified/pending/verified only; there is no
    // 'rejected' member to write.
    const m = makeClient()
    m.queueSingle({ id: 'v1', user_id: 'agent-1', role: 'agent', status: 'rejected' })
    await reviewVerification(m.client, 'v1', 'admin-1', 'reject')

    const profileWrite = m.writes.find((w) => w.table === 'agent_profiles')
    expect(profileWrite?.payload).toMatchObject({
      verification_status: 'unverified',
      is_verified: false,
      verified_at: null,
    })
  })

  it('writes back to no profile table for the roles that have no such column', async () => {
    const m = makeClient()
    m.queueSingle({ id: 'v1', user_id: 'u1', role: 'athlete', status: 'approved' })
    await reviewVerification(m.client, 'v1', 'admin-1', 'approve')

    expect(m.writes.map((w) => w.table)).toEqual(['verification_requests'])
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
