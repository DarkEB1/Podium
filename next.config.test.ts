import { describe, it, expect } from 'vitest'
import nextConfig from './next.config'

// WS-INFRA-02: the live site sent no security headers, so the sign-in, signup
// and "sign contract" screens were fram' able for clickjacking and responses
// were sniffable. These assertions lock the header contract in place.
describe('security headers (WS-INFRA-02)', () => {
  async function headersFor(path: string): Promise<Record<string, string>> {
    const groups = await nextConfig.headers!()
    const match = groups.find((g) => path.match(new RegExp(`^${g.source.replace('(.*)', '.*')}$`)))
    expect(match, `a header group should cover ${path}`).toBeTruthy()
    return Object.fromEntries(match!.headers.map((h) => [h.key.toLowerCase(), h.value]))
  }

  it('applies to every route', async () => {
    const groups = await nextConfig.headers!()
    expect(groups.some((g) => g.source === '/(.*)')).toBe(true)
  })

  it('denies framing (clickjacking) via both XFO and CSP frame-ancestors', async () => {
    const h = await headersFor('/auth')
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
  })

  it('sets nosniff, a referrer policy and a permissions policy', async () => {
    const h = await headersFor('/auth/signup')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['permissions-policy']).toMatch(/camera=\(\)/)
    expect(h['permissions-policy']).toMatch(/microphone=\(\)/)
    expect(h['permissions-policy']).toMatch(/geolocation=\(\)/)
  })

  it('allow-lists the origins the app actually needs in the CSP', async () => {
    const csp = (await headersFor('/'))['content-security-policy']
    // Supabase (DB, auth, realtime, storage) over https + wss.
    expect(csp).toMatch(/https:\/\/\*\.supabase\.co/)
    expect(csp).toMatch(/wss:\/\/\*\.supabase\.co/)
    // Stripe.js and its API / checkout frames.
    expect(csp).toMatch(/js\.stripe\.com/)
    expect(csp).toMatch(/api\.stripe\.com/)
    // Locks down the dangerous sinks.
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })
})

describe('framework fingerprint', () => {
  // The report flagged x-powered-by: Next.js on dynamic responses.
  it('does not advertise the framework via x-powered-by', () => {
    expect(nextConfig.poweredByHeader).toBe(false)
  })
})
