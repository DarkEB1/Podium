import { describe, it, expect, vi } from 'vitest'
import {
  claimDelivery,
  markDelivery,
  isSuppressed,
  addSuppression,
  getUserEmail,
  normaliseEmail,
  EmailStoreError,
} from './email'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Mock factory (mirrors lib/supabase/messaging.test.ts) with maybeSingle and
// upsert added for the email store's query shapes.
// ---------------------------------------------------------------------------

function makeMockClient() {
  const singleQueue: Array<{ data: unknown; error: unknown }> = []
  const maybeSingleQueue: Array<{ data: unknown; error: unknown }> = []
  const listQueue: Array<{ data: unknown; error: unknown }> = []

  const mockSingle = vi.fn().mockImplementation(() =>
    Promise.resolve(singleQueue.shift() ?? { data: null, error: null })
  )
  const mockMaybeSingle = vi.fn().mockImplementation(() =>
    Promise.resolve(maybeSingleQueue.shift() ?? { data: null, error: null })
  )

  const chain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then(
      resolve: (v: unknown) => void,
      reject?: ((reason: unknown) => void) | null
    ): Promise<unknown> {
      const r = listQueue.shift() ?? { data: null, error: null }
      return Promise.resolve(r).then(resolve, reject ?? undefined)
    },
  }

  chain.select.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.upsert.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)

  const mockFrom = vi.fn().mockReturnValue(chain)

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    queueSingle(data: unknown, error: unknown = null) {
      singleQueue.push({ data, error })
    },
    queueMaybeSingle(data: unknown, error: unknown = null) {
      maybeSingleQueue.push({ data, error })
    },
    queueList(data: unknown, error: unknown = null) {
      listQueue.push({ data, error })
    },
  }
}

// ---------------------------------------------------------------------------
// normaliseEmail
// ---------------------------------------------------------------------------

describe('normaliseEmail', () => {
  it('lowercases and trims', () => {
    expect(normaliseEmail('  Maya@Example.COM  ')).toBe('maya@example.com')
  })
})

// ---------------------------------------------------------------------------
// claimDelivery
// ---------------------------------------------------------------------------

describe('claimDelivery', () => {
  it('inserts a queued row and returns claimed:true', async () => {
    const { client, chain, mockFrom, queueSingle } = makeMockClient()
    queueSingle({ id: 'd1' })

    const result = await claimDelivery(client, {
      userId: 'u1',
      toEmail: 'a@b.com',
      eventType: 'proposal_received',
      subject: 'New proposal',
    })

    expect(result).toEqual({ id: 'd1', claimed: true })
    expect(mockFrom).toHaveBeenCalledWith('email_deliveries')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        to_email: 'a@b.com',
        event_type: 'proposal_received',
        status: 'queued',
      })
    )
  })

  it('on a 23505 unique violation with an idempotencyKey, looks up and returns claimed:false', async () => {
    const { client, chain, queueSingle } = makeMockClient()
    // First insert fails with a unique violation, then the lookup finds the row.
    queueSingle(null, { code: '23505', message: 'duplicate key' })
    queueSingle({ id: 'existing' })

    const result = await claimDelivery(client, {
      userId: 'u1',
      toEmail: 'a@b.com',
      eventType: 'proposal_received',
      subject: 'New proposal',
      idempotencyKey: 'proposal:1',
    })

    expect(result).toEqual({ id: 'existing', claimed: false })
    expect(chain.eq).toHaveBeenCalledWith('idempotency_key', 'proposal:1')
  })

  it('throws DELIVERY_INSERT_FAILED on a non-unique-violation error', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: '42000', message: 'boom' })

    await expect(
      claimDelivery(client, {
        userId: 'u1',
        toEmail: 'a@b.com',
        eventType: 'proposal_received',
        subject: 'x',
      })
    ).rejects.toMatchObject({ code: 'DELIVERY_INSERT_FAILED' })
  })
})

// ---------------------------------------------------------------------------
// markDelivery
// ---------------------------------------------------------------------------

describe('markDelivery', () => {
  it('updates the row by id with the patched status', async () => {
    const { client, chain, mockFrom, queueList } = makeMockClient()
    queueList(null)

    await markDelivery(client, 'd1', { status: 'sent', providerId: 'p1', attempts: 1 })

    expect(mockFrom).toHaveBeenCalledWith('email_deliveries')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', provider_id: 'p1', attempts: 1 })
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 'd1')
  })

  it('throws DELIVERY_UPDATE_FAILED on a DB error', async () => {
    const { client, queueList } = makeMockClient()
    queueList(null, { message: 'nope' })

    await expect(markDelivery(client, 'd1', { status: 'failed' })).rejects.toMatchObject({
      code: 'DELIVERY_UPDATE_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// isSuppressed
// ---------------------------------------------------------------------------

describe('isSuppressed', () => {
  it('returns true when a suppression row exists', async () => {
    const { client, chain, queueMaybeSingle } = makeMockClient()
    queueMaybeSingle({ email: 'a@b.com' })

    await expect(isSuppressed(client, 'A@B.com')).resolves.toBe(true)
    // Looks up the normalised address.
    expect(chain.eq).toHaveBeenCalledWith('email', 'a@b.com')
  })

  it('returns false when no row exists', async () => {
    const { client, queueMaybeSingle } = makeMockClient()
    queueMaybeSingle(null)

    await expect(isSuppressed(client, 'a@b.com')).resolves.toBe(false)
  })

  it('throws SUPPRESSION_LOOKUP_FAILED on a DB error', async () => {
    const { client, queueMaybeSingle } = makeMockClient()
    queueMaybeSingle(null, { message: 'boom' })

    await expect(isSuppressed(client, 'a@b.com')).rejects.toMatchObject({
      code: 'SUPPRESSION_LOOKUP_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// addSuppression
// ---------------------------------------------------------------------------

describe('addSuppression', () => {
  it('upserts the normalised address with ignoreDuplicates on the email conflict', async () => {
    const { client, chain, mockFrom, queueList } = makeMockClient()
    queueList(null)

    await addSuppression(client, { email: 'A@B.com', reason: 'hard_bounce' })

    expect(mockFrom).toHaveBeenCalledWith('email_suppressions')
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', reason: 'hard_bounce' }),
      { onConflict: 'email', ignoreDuplicates: true }
    )
  })

  it('throws SUPPRESSION_INSERT_FAILED on a DB error', async () => {
    const { client, queueList } = makeMockClient()
    queueList(null, { message: 'boom' })

    await expect(
      addSuppression(client, { email: 'a@b.com', reason: 'complaint' })
    ).rejects.toMatchObject({ code: 'SUPPRESSION_INSERT_FAILED' })
  })
})

// ---------------------------------------------------------------------------
// getUserEmail
// ---------------------------------------------------------------------------

describe('getUserEmail', () => {
  it('returns the address when the user exists', async () => {
    const { client, chain, mockFrom, queueMaybeSingle } = makeMockClient()
    queueMaybeSingle({ email: 'maya@example.com' })

    await expect(getUserEmail(client, 'u1')).resolves.toBe('maya@example.com')
    expect(mockFrom).toHaveBeenCalledWith('users')
    expect(chain.eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('returns null when the user has no row', async () => {
    const { client, queueMaybeSingle } = makeMockClient()
    queueMaybeSingle(null)

    await expect(getUserEmail(client, 'u1')).resolves.toBeNull()
  })

  it('throws USER_EMAIL_LOOKUP_FAILED on a DB error', async () => {
    const { client, queueMaybeSingle } = makeMockClient()
    queueMaybeSingle(null, { message: 'boom' })

    await expect(getUserEmail(client, 'u1')).rejects.toMatchObject({
      code: 'USER_EMAIL_LOOKUP_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// EmailStoreError
// ---------------------------------------------------------------------------

describe('EmailStoreError', () => {
  it('is an Error carrying a code', () => {
    const err = new EmailStoreError('SOME_CODE', 'message')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('SOME_CODE')
    expect(err.name).toBe('EmailStoreError')
  })
})
