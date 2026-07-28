import { describe, it, expect, afterEach } from 'vitest'
import { isSocialProvider, providerConfigured, PROVIDERS } from './providers'
import { buildAuthorizeUrl, generateState, SocialError } from './index'

const KEYS = ['META_CLIENT_ID', 'META_CLIENT_SECRET', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET']
afterEach(() => {
  for (const k of KEYS) delete process.env[k]
})

describe('provider registry', () => {
  it('recognises the five providers and rejects others', () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(['linkedin', 'meta', 'tiktok', 'x', 'youtube'])
    expect(isSocialProvider('meta')).toBe(true)
    expect(isSocialProvider('myspace')).toBe(false)
  })

  it('is unconfigured without credentials, configured with them', () => {
    expect(providerConfigured('meta')).toBe(false)
    process.env.META_CLIENT_ID = 'id'
    process.env.META_CLIENT_SECRET = 'secret'
    expect(providerConfigured('meta')).toBe(true)
  })
})

describe('buildAuthorizeUrl', () => {
  it('builds a code-flow url with state and redirect', () => {
    process.env.META_CLIENT_ID = 'abc'
    const url = buildAuthorizeUrl('meta', 'st8', 'https://podium.app/api/social/meta/callback')
    expect(url.startsWith(PROVIDERS.meta.authorizeUrl)).toBe(true)
    expect(url).toContain('response_type=code')
    expect(url).toContain('client_id=abc')
    expect(url).toContain('state=st8')
    expect(url).toContain('redirect_uri=https%3A%2F%2Fpodium.app%2Fapi%2Fsocial%2Fmeta%2Fcallback')
  })

  it('uses client_key for TikTok', () => {
    process.env.TIKTOK_CLIENT_KEY = 'tk'
    const url = buildAuthorizeUrl('tiktok', 's', 'https://podium.app/cb')
    expect(url).toContain('client_key=tk')
  })

  it('throws when the provider is not configured', () => {
    expect(() => buildAuthorizeUrl('x', 's', 'https://podium.app/cb')).toThrow(SocialError)
  })

  it('generates distinct state values', () => {
    expect(generateState()).not.toBe(generateState())
  })
})
