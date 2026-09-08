import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resetEnvCache } from '@/lib/env'
import { provider } from './index'

// serverEnv() validates the whole server schema, not just ESIGN_PROVIDER, so
// the other required keys (unrelated to e-signing) must be present too —
// mirrors the setValid() pattern in lib/env.test.ts.
const REQUIRED_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_TIER_1',
  'STRIPE_PRICE_TIER_2',
  'STRIPE_PRICE_TIER_3',
] as const
const original: Record<string, string | undefined> = {}

describe('esign provider selector', () => {
  beforeEach(() => {
    for (const k of REQUIRED_KEYS) original[k] = process.env[k]
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
    process.env.STRIPE_PRICE_TIER_1 = 'price_1'
    process.env.STRIPE_PRICE_TIER_2 = 'price_2'
    process.env.STRIPE_PRICE_TIER_3 = 'price_3'
    resetEnvCache()
  })
  afterEach(() => {
    for (const k of REQUIRED_KEYS) {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    }
    resetEnvCache()
  })

  it('returns the podium provider by default', () => {
    delete process.env.ESIGN_PROVIDER
    resetEnvCache()
    expect(provider().name).toBe('podium')
  })
})
