import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import sitemap, { publicSitemapPaths, siteUrl } from './sitemap'
import robots, { DISALLOWED_PATHS } from './robots'
import { resetEnvCache } from '@/lib/env'

const AUTHENTICATED_PREFIXES = ['/athlete', '/brand', '/team', '/agent', '/admin', '/api']

describe('sitemap', () => {
  const originalUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'anon'
    process.env.NEXT_PUBLIC_APP_URL = 'https://podium.test/'
    resetEnvCache()
  })

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = originalUrl
    resetEnvCache()
  })

  it('builds absolute URLs from the validated env, without a doubled slash', () => {
    const urls = sitemap().map((e) => e.url)
    expect(urls).toContain('https://podium.test/')
    expect(urls).toContain('https://podium.test/pricing')
    expect(urls.every((u) => !u.includes('//pricing'))).toBe(true)
  })

  it('lists the public marketing routes', () => {
    expect(publicSitemapPaths()).toEqual(
      expect.arrayContaining(['/', '/pricing', '/terms', '/privacy', '/cookies'])
    )
  })

  // The whole point: an authenticated route must never appear in a sitemap.
  it('lists no authenticated route', () => {
    for (const url of sitemap().map((e) => e.url)) {
      const path = url.replace('https://podium.test', '')
      for (const prefix of AUTHENTICATED_PREFIXES) {
        expect(path.startsWith(prefix), `${path} must not be in the sitemap`).toBe(false)
      }
    }
  })

  it('lists no auth-flow route', () => {
    expect(publicSitemapPaths().some((p) => p.startsWith('/auth'))).toBe(false)
    expect(publicSitemapPaths()).not.toContain('/role-select')
    expect(publicSitemapPaths()).not.toContain('/update-password')
  })

  it('gives every entry a lastModified, changeFrequency and priority', () => {
    for (const entry of sitemap()) {
      expect(entry.lastModified).toBeInstanceOf(Date)
      expect(entry.changeFrequency).toBeTruthy()
      expect(typeof entry.priority).toBe('number')
    }
  })

  it('ranks the landing page highest', () => {
    const home = sitemap().find((e) => e.url === 'https://podium.test/')
    expect(home?.priority).toBe(1)
  })

  it('falls back rather than throwing when the app URL is unset', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    resetEnvCache()

    expect(() => siteUrl()).not.toThrow()
    expect(sitemap().length).toBeGreaterThan(0)
  })
})

describe('robots', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'anon'
    process.env.NEXT_PUBLIC_APP_URL = 'https://podium.test'
    resetEnvCache()
  })

  it('disallows every authenticated area and the API', () => {
    const rule = robots().rules
    const rules = Array.isArray(rule) ? rule : [rule]
    const disallow = rules.flatMap((r) => (Array.isArray(r.disallow) ? r.disallow : [r.disallow]))

    for (const required of ['/api/', '/athlete/', '/brand/', '/team/', '/agent/', '/admin/']) {
      expect(disallow).toContain(required)
    }
  })

  it('allows the public marketing surface', () => {
    const rules = robots().rules
    const first = Array.isArray(rules) ? rules[0] : rules
    expect(first?.allow).toBe('/')
    expect(first?.userAgent).toBe('*')
  })

  it('points at the sitemap on the same origin', () => {
    expect(robots().sitemap).toBe('https://podium.test/sitemap.xml')
  })

  it('never disallows a path that the sitemap advertises', () => {
    for (const listed of publicSitemapPaths()) {
      for (const blocked of DISALLOWED_PATHS) {
        const collides = listed === blocked || (blocked.endsWith('/') && listed.startsWith(blocked))
        expect(collides, `${listed} is both listed and disallowed`).toBe(false)
      }
    }
  })
})
