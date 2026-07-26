import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { serverEnv, clientEnv, resetEnvCache, EnvValidationError } from './env'

const SERVER_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_TIER_1',
  'STRIPE_PRICE_TIER_2',
  'STRIPE_PRICE_TIER_3',
] as const

const CLIENT_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
] as const

const original: Record<string, string | undefined> = {}

function setValid() {
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-key'
  process.env['STRIPE_SECRET_KEY'] = 'sk_test_123'
  process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_123'
  process.env['STRIPE_PRICE_TIER_1'] = 'price_1'
  process.env['STRIPE_PRICE_TIER_2'] = 'price_2'
  process.env['STRIPE_PRICE_TIER_3'] = 'price_3'
  process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://test.supabase.co'
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'anon-key'
  process.env['NEXT_PUBLIC_APP_URL'] = 'http://localhost:3000'
  delete process.env['NEXT_PUBLIC_SITE_URL']
  delete process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']
  resetEnvCache()
}

beforeEach(() => {
  for (const k of [...SERVER_KEYS, ...CLIENT_KEYS]) original[k] = process.env[k]
  setValid()
})

afterEach(() => {
  for (const [k, v] of Object.entries(original)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  resetEnvCache()
})

// ---------------------------------------------------------------------------
// Import safety — the whole point of the lazy accessor
// ---------------------------------------------------------------------------

describe('lib/env import safety', () => {
  it('does not throw at import time when the environment is empty', async () => {
    for (const k of [...SERVER_KEYS, ...CLIENT_KEYS]) delete process.env[k]
    resetEnvCache()

    // A fresh import with a blank environment must still resolve.
    await expect(import('./env')).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// serverEnv
// ---------------------------------------------------------------------------

describe('serverEnv', () => {
  it('returns typed values when everything is set', () => {
    const env = serverEnv()
    expect(env.STRIPE_SECRET_KEY).toBe('sk_test_123')
    expect(env.STRIPE_WEBHOOK_SECRET).toBe('whsec_123')
    expect(env.STRIPE_PRICE_TIER_2).toBe('price_2')
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('service-role-key')
  })

  it('memoises the parsed result', () => {
    const first = serverEnv()
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_changed'
    expect(serverEnv()).toBe(first)
  })

  it('re-reads process.env after resetEnvCache()', () => {
    serverEnv()
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_changed'
    resetEnvCache()
    expect(serverEnv().STRIPE_SECRET_KEY).toBe('sk_test_changed')
  })

  it('throws EnvValidationError naming the missing variable', () => {
    delete process.env['STRIPE_WEBHOOK_SECRET']
    resetEnvCache()

    expect(() => serverEnv()).toThrow(EnvValidationError)
    expect(() => serverEnv()).toThrow(/STRIPE_WEBHOOK_SECRET/)
  })

  it('aggregates EVERY problem into one error instead of failing on the first', () => {
    delete process.env['STRIPE_SECRET_KEY']
    delete process.env['STRIPE_PRICE_TIER_1']
    delete process.env['STRIPE_PRICE_TIER_3']
    resetEnvCache()

    try {
      serverEnv()
      expect.unreachable('serverEnv should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError)
      const e = err as EnvValidationError
      expect(e.issues).toHaveLength(3)
      expect(e.message).toContain('STRIPE_SECRET_KEY')
      expect(e.message).toContain('STRIPE_PRICE_TIER_1')
      expect(e.message).toContain('STRIPE_PRICE_TIER_3')
    }
  })

  it('includes a hint saying where to obtain the value', () => {
    delete process.env['STRIPE_WEBHOOK_SECRET']
    resetEnvCache()

    expect(() => serverEnv()).toThrow(/stripe listen/)
  })

  it('rejects an empty string (the `?? \'\'` failure mode this replaces)', () => {
    process.env['STRIPE_SECRET_KEY'] = ''
    resetEnvCache()

    expect(() => serverEnv()).toThrow(/STRIPE_SECRET_KEY/)
  })

  it('rejects a malformed Stripe secret key', () => {
    process.env['STRIPE_SECRET_KEY'] = 'pk_test_publishable'
    resetEnvCache()

    expect(() => serverEnv()).toThrow(/sk_/)
  })

  it('accepts a restricted key', () => {
    process.env['STRIPE_SECRET_KEY'] = 'rk_test_restricted'
    resetEnvCache()

    expect(serverEnv().STRIPE_SECRET_KEY).toBe('rk_test_restricted')
  })

  it('rejects a webhook secret that is not a whsec_ signing secret', () => {
    process.env['STRIPE_WEBHOOK_SECRET'] = 'sk_test_oops'
    resetEnvCache()

    expect(() => serverEnv()).toThrow(/whsec_/)
  })
})

// ---------------------------------------------------------------------------
// clientEnv
// ---------------------------------------------------------------------------

describe('clientEnv', () => {
  it('returns the NEXT_PUBLIC_* values', () => {
    const env = clientEnv()
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co')
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000')
  })

  it('never exposes a server-only secret', () => {
    expect(Object.keys(clientEnv())).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(Object.keys(clientEnv())).not.toContain('STRIPE_SECRET_KEY')
  })

  it('succeeds even when every server secret is absent', () => {
    for (const k of SERVER_KEYS) delete process.env[k]
    resetEnvCache()

    expect(() => clientEnv()).not.toThrow()
  })

  it('accepts NEXT_PUBLIC_SITE_URL as an alias for NEXT_PUBLIC_APP_URL', () => {
    delete process.env['NEXT_PUBLIC_APP_URL']
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://podium.test'
    resetEnvCache()

    expect(clientEnv().NEXT_PUBLIC_APP_URL).toBe('https://podium.test')
  })

  it('rejects a non-URL supabase url', () => {
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'not-a-url'
    resetEnvCache()

    expect(() => clientEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('treats NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as optional', () => {
    delete process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']
    resetEnvCache()

    expect(clientEnv().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// CRON_SECRET / SENTRY_DSN — ST-2 / SEC-5 / DH-6
// ---------------------------------------------------------------------------

describe('serverEnv optional operational secrets', () => {
  const OPTIONAL_KEYS = ['CRON_SECRET', 'SENTRY_DSN'] as const
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of OPTIONAL_KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
    resetEnvCache()
  })

  afterEach(() => {
    for (const k of OPTIONAL_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
    resetEnvCache()
  })

  // Required-vs-optional: the cron routes fail closed on their own, so an unset
  // secret must NOT take down Stripe checkout and the admin client with it.
  it('does not fail the whole server env when CRON_SECRET is unset', () => {
    expect(() => serverEnv()).not.toThrow()
    expect(serverEnv().CRON_SECRET).toBeUndefined()
  })

  it('accepts a high-entropy CRON_SECRET', () => {
    process.env['CRON_SECRET'] = 'a'.repeat(64)
    resetEnvCache()

    expect(serverEnv().CRON_SECRET).toHaveLength(64)
  })

  // The failure this catches: a truncated paste or leftover placeholder that
  // authenticates nothing and 401s the GDPR erasure job forever.
  it('rejects a CRON_SECRET that is set but too short to be a real secret', () => {
    process.env['CRON_SECRET'] = 'changeme'
    resetEnvCache()

    expect(() => serverEnv()).toThrow(EnvValidationError)
    expect(() => serverEnv()).toThrow(/CRON_SECRET/)
  })

  it('treats an empty CRON_SECRET as unset rather than as an invalid value', () => {
    process.env['CRON_SECRET'] = ''
    resetEnvCache()

    expect(() => serverEnv()).not.toThrow()
  })

  it('names the generator command in the aggregated error', () => {
    process.env['CRON_SECRET'] = 'short'
    resetEnvCache()

    expect(() => serverEnv()).toThrow(/openssl rand -hex 32/)
  })

  it('treats SENTRY_DSN as optional but validates its shape when present', () => {
    expect(serverEnv().SENTRY_DSN).toBeUndefined()

    process.env['SENTRY_DSN'] = 'not-a-url'
    resetEnvCache()
    expect(() => serverEnv()).toThrow(/SENTRY_DSN/)

    process.env['SENTRY_DSN'] = 'https://public@o0.ingest.sentry.io/0'
    resetEnvCache()
    expect(serverEnv().SENTRY_DSN).toContain('sentry.io')
  })
})

describe('.env.local.example', () => {
  it('documents every optional operational secret', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const example = readFileSync(
      path.resolve(__dirname, '..', '.env.local.example'),
      'utf8'
    )

    expect(example).toContain('CRON_SECRET')
    expect(example).toContain('openssl rand -hex 32')
    expect(example).toContain('SENTRY_DSN')
  })
})
