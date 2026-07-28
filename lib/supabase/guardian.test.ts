import { describe, it, expect, vi } from 'vitest'
import {
  generateRawToken,
  hashToken,
  requestGuardianConsent,
  getConsentTokenStatus,
  acceptGuardianConsent,
  GuardianConsentError,
} from './guardian'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Mock admin client
//
// Two chains are exercised:
//   select(...).eq(...).maybeSingle()   -> resolves from `singleQueue`
//   insert(...)                          -> resolves from `mutationQueue`
//   update(...).eq(...)                  -> resolves from `mutationQueue`
// ---------------------------------------------------------------------------
function makeAdmin() {
  const singleQueue: Array<{ data: unknown; error: unknown }> = []
  const mutationQueue: Array<{ error: unknown }> = []
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> = []
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = []

  let currentTable = ''
  let pendingMutation: { error: unknown } | undefined

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(singleQueue.shift() ?? { data: null, error: null })),
    insert: vi.fn((payload: Record<string, unknown>) => {
      inserts.push({ table: currentTable, payload })
      return Promise.resolve(mutationQueue.shift() ?? { error: null })
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push({ table: currentTable, payload })
      pendingMutation = mutationQueue.shift() ?? { error: null }
      return builder
    }),
    // update(...).eq(...) is awaited: resolve the pending mutation.
    then(onFulfilled: (v: { error: unknown }) => unknown) {
      const r = pendingMutation ?? { error: null }
      pendingMutation = undefined
      return Promise.resolve(r).then(onFulfilled)
    },
  }

  const admin = {
    from: vi.fn((table: string) => {
      currentTable = table
      return builder
    }),
  } as unknown as SupabaseClient<Database>

  return {
    admin,
    singleQueue,
    mutationQueue,
    inserts,
    updates,
    queueSingle: (data: unknown, error: unknown = null) => singleQueue.push({ data, error }),
    queueMutation: (error: unknown = null) => mutationQueue.push({ error }),
  }
}

const future = () => new Date(Date.now() + 60_000).toISOString()
const past = () => new Date(Date.now() - 60_000).toISOString()

const underageAthlete = {
  user_id: 'ath-1',
  is_under_18: true,
  guardian_accepted_at: null,
  guardian_email: 'guardian@example.com',
  guardian_name: 'Jane Guardian',
  display_name: 'Sam Athlete',
  full_legal_name: 'Samuel Athlete',
}

describe('token primitives', () => {
  it('hashes a raw token to 64 hex chars and never returns the raw value', () => {
    const raw = generateRawToken()
    const hash = hashToken(raw)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toEqual(raw)
    expect(hashToken(raw)).toEqual(hash) // deterministic
  })

  it('generates distinct tokens', () => {
    expect(generateRawToken()).not.toEqual(generateRawToken())
  })
})

describe('requestGuardianConsent', () => {
  it('mints a token for an eligible under-18 athlete and stores only its hash', async () => {
    const m = makeAdmin()
    m.queueSingle(underageAthlete) // fetchAthleteConsent
    m.queueMutation() // insert token

    const result = await requestGuardianConsent(m.admin, 'ath-1')

    expect(result.guardianEmail).toBe('guardian@example.com')
    expect(result.athleteName).toBe('Sam Athlete')
    expect(result.rawToken).toBeTruthy()

    const insert = m.inserts.find((i) => i.table === 'guardian_consent_tokens')
    expect(insert).toBeTruthy()
    expect(insert!.payload.token_hash).toBe(hashToken(result.rawToken))
    expect(insert!.payload.token_hash).not.toBe(result.rawToken)
    expect(new Date(insert!.payload.expires_at as string).getTime()).toBeGreaterThan(Date.now())
  })

  it('refuses an athlete who is not under 18', async () => {
    const m = makeAdmin()
    m.queueSingle({ ...underageAthlete, is_under_18: false })
    await expect(requestGuardianConsent(m.admin, 'ath-1')).rejects.toMatchObject({
      code: 'NOT_UNDER_18',
    })
  })

  it('refuses when consent is already recorded', async () => {
    const m = makeAdmin()
    m.queueSingle({ ...underageAthlete, guardian_accepted_at: future() })
    await expect(requestGuardianConsent(m.admin, 'ath-1')).rejects.toMatchObject({
      code: 'ALREADY_CONSENTED',
    })
  })

  it('refuses when no guardian email is on file', async () => {
    const m = makeAdmin()
    m.queueSingle({ ...underageAthlete, guardian_email: null })
    await expect(requestGuardianConsent(m.admin, 'ath-1')).rejects.toMatchObject({
      code: 'NO_GUARDIAN_EMAIL',
    })
  })

  it('throws ATHLETE_NOT_FOUND when the profile is missing', async () => {
    const m = makeAdmin()
    m.queueSingle(null)
    await expect(requestGuardianConsent(m.admin, 'nope')).rejects.toBeInstanceOf(GuardianConsentError)
  })
})

describe('getConsentTokenStatus', () => {
  it('returns valid with the athlete name for a live token', async () => {
    const m = makeAdmin()
    m.queueSingle({ id: 't1', athlete_user_id: 'ath-1', token_hash: 'x', expires_at: future(), consumed_at: null })
    m.queueSingle(underageAthlete)
    const status = await getConsentTokenStatus(m.admin, 'raw')
    expect(status).toMatchObject({ status: 'valid', athleteUserId: 'ath-1', athleteName: 'Sam Athlete' })
  })

  it('reports a consumed token', async () => {
    const m = makeAdmin()
    m.queueSingle({ id: 't1', athlete_user_id: 'ath-1', token_hash: 'x', expires_at: future(), consumed_at: past() })
    expect(await getConsentTokenStatus(m.admin, 'raw')).toEqual({ status: 'consumed' })
  })

  it('reports an expired token', async () => {
    const m = makeAdmin()
    m.queueSingle({ id: 't1', athlete_user_id: 'ath-1', token_hash: 'x', expires_at: past(), consumed_at: null })
    expect(await getConsentTokenStatus(m.admin, 'raw')).toEqual({ status: 'expired' })
  })

  it('reports invalid for an unknown token', async () => {
    const m = makeAdmin()
    m.queueSingle(null)
    expect(await getConsentTokenStatus(m.admin, 'raw')).toEqual({ status: 'invalid' })
  })
})

describe('acceptGuardianConsent', () => {
  it('stamps guardian_accepted_at and consumes the token', async () => {
    const m = makeAdmin()
    m.queueSingle({ id: 't1', athlete_user_id: 'ath-1', token_hash: 'x', expires_at: future(), consumed_at: null }) // token
    m.queueSingle(underageAthlete) // athlete
    m.queueMutation() // stamp athlete
    m.queueMutation() // consume token

    const result = await acceptGuardianConsent(m.admin, 'raw')
    expect(result).toMatchObject({ athleteUserId: 'ath-1', athleteName: 'Sam Athlete' })

    const stamp = m.updates.find((u) => u.table === 'athlete_profiles')
    expect(stamp?.payload.guardian_accepted_at).toBeTruthy()
    const consume = m.updates.find((u) => u.table === 'guardian_consent_tokens')
    expect(consume?.payload.consumed_at).toBeTruthy()
  })

  it('rejects an expired token', async () => {
    const m = makeAdmin()
    m.queueSingle({ id: 't1', athlete_user_id: 'ath-1', token_hash: 'x', expires_at: past(), consumed_at: null })
    await expect(acceptGuardianConsent(m.admin, 'raw')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' })
  })

  it('rejects an unknown token', async () => {
    const m = makeAdmin()
    m.queueSingle(null)
    await expect(acceptGuardianConsent(m.admin, 'raw')).rejects.toMatchObject({ code: 'TOKEN_INVALID' })
  })

  it('is idempotent when already consumed and already consented', async () => {
    const m = makeAdmin()
    m.queueSingle({ id: 't1', athlete_user_id: 'ath-1', token_hash: 'x', expires_at: future(), consumed_at: past() })
    m.queueSingle({ ...underageAthlete, guardian_accepted_at: past() })
    const result = await acceptGuardianConsent(m.admin, 'raw')
    expect(result.athleteUserId).toBe('ath-1')
    // no mutations needed on the idempotent replay
    expect(m.updates).toHaveLength(0)
  })
})
