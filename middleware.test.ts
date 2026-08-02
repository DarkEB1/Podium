// @vitest-environment node
// Middleware runs on the edge runtime, not in a DOM: NextResponse.next() rejects
// jsdom's Headers implementation.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const createServerClient = vi.fn()
vi.mock('@supabase/ssr', () => ({ createServerClient: (...args: unknown[]) => createServerClient(...args) }))

import { middleware, ROLE_HEADER } from './middleware'

interface Row { [key: string]: unknown }

/**
 * Minimal Supabase stub: `auth.getUser()` plus a `from(table)` query chain that
 * resolves to the row registered for that table.
 */
function stubSupabase(user: { id: string } | null, rows: Record<string, Row | null>) {
  /** Every `from(table)` the middleware issued, in order — the query budget. */
  const queries: { table: string; columns: string }[] = []

  createServerClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from(table: string) {
      const result = { data: rows[table] ?? null, error: null }
      const chain = {
        select: (columns = '') => {
          queries.push({ table, columns })
          return chain
        },
        eq: () => chain,
        single: async () => result,
        maybeSingle: async () => result,
      }
      return chain
    },
  })

  return queries
}

function request(pathname: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(pathname, 'http://localhost'), { headers })
}

/**
 * The header value a Server Component would observe on the forwarded request.
 * `NextResponse.next({ request })` encodes overridden request headers onto the
 * response as `x-middleware-request-<name>`.
 */
function forwardedHeader(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`)
}

function redirectedTo(res: Response): string | null {
  const location = res.headers.get('location')
  return location ? new URL(location).pathname : null
}

const COMPLETE_ATHLETE = {
  status: 'active',
  display_name: 'Maya',
  home_country: 'GB',
  profile_photo_url: 'https://x/y.jpg',
  primary_sport: 'Athletics',
  availability_status: 'available_now',
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://example.supabase.co'
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'anon-key'
  })

  describe('public access (B-7/B-10)', () => {
    // The landing nav links here; signed-out visitors must not be bounced.
    it.each(['/', '/pricing', '/terms', '/privacy', '/how-it-works', '/auth', '/auth/signup'])(
      'lets a signed-out visitor reach %s',
      async (path) => {
        stubSupabase(null, {})
        const res = await middleware(request(path))
        expect(redirectedTo(res)).toBeNull()
      },
    )

    // These callers can never hold a session: Stripe posts signed webhook
    // events from its own servers, and a guardian follows an emailed token
    // link without having an account. Each route enforces its own auth
    // (HMAC signature / consent token); a redirect to /auth silently breaks
    // subscription state and the entire guardian-consent flow.
    it.each([
      '/api/webhooks/stripe',
      '/api/webhooks/stripe-connect',
      '/guardian/consent/some-token',
      '/api/guardian-consent/accept',
    ])('lets a sessionless caller reach %s', async (path) => {
      stubSupabase(null, {})
      const res = await middleware(request(path))
      expect(redirectedTo(res)).toBeNull()
    })

    it('sends a signed-out visitor on a private route to the sign-in page', async () => {
      stubSupabase(null, {})
      const res = await middleware(request('/athlete/discover'))
      expect(redirectedTo(res)).toBe('/auth')
    })
  })

  describe('mandatory, resumable onboarding (PR-9)', () => {
    it('sends an athlete with no profile to the first onboarding step', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: 'athlete' }, athlete_profiles: null })
      const res = await middleware(request('/athlete/discover'))
      expect(redirectedTo(res)).toBe('/athlete/onboarding/step/1')
    })

    it('resumes a partially-complete athlete at their furthest step', async () => {
      stubSupabase(
        { id: 'u1' },
        {
          users: { role: 'athlete' },
          athlete_profiles: {
            status: 'draft',
            display_name: 'Maya',
            home_country: 'GB',
            profile_photo_url: 'https://x/y.jpg',
            primary_sport: 'Athletics',
          },
        },
      )
      const res = await middleware(request('/athlete/discover'))
      expect(redirectedTo(res)).toBe('/athlete/onboarding/step/3')
    })

    it('does not redirect a user who is already inside onboarding (no loop)', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: 'athlete' }, athlete_profiles: null })
      const res = await middleware(request('/athlete/onboarding/step/1'))
      expect(redirectedTo(res)).toBeNull()
    })

    it('leaves the auth and logout routes reachable so nobody gets trapped', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: 'athlete' }, athlete_profiles: null })
      for (const path of ['/api/auth/logout', '/auth', '/role-select']) {
        const res = await middleware(request(path))
        expect(redirectedTo(res), path).toBeNull()
      }
    })

    it('lets a published profile through untouched', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: 'athlete' }, athlete_profiles: COMPLETE_ATHLETE })
      const res = await middleware(request('/athlete/discover'))
      expect(redirectedTo(res)).toBeNull()
    })

    it('sends a role-less user to pick a role rather than looping', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: null } })
      const res = await middleware(request('/athlete/discover'))
      expect(redirectedTo(res)).toBeNull()
    })
  })

  describe('admin', () => {
    it('sends a non-admin away from /admin', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: 'athlete' } })
      const res = await middleware(request('/admin/dashboard'))
      expect(redirectedTo(res)).toBe('/403')
    })
  })

  // ── FA-3 / NX-6 ──────────────────────────────────────────────────────────
  describe('role header (FA-3/NX-6)', () => {
    it('forwards the resolved role so Server Components need not re-query', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: 'athlete' }, athlete_profiles: COMPLETE_ATHLETE })
      const res = await middleware(request('/athlete/discover'))
      expect(redirectedTo(res)).toBeNull()
      expect(forwardedHeader(res, ROLE_HEADER)).toBe('athlete')
    })

    // SECURITY: a client can put any header on any request. If middleware did
    // not delete inbound x-podium-* first, `x-podium-role: admin` sent from a
    // browser would reach Server Components as though middleware had vouched
    // for it — turning a perf optimisation into an auth bypass.
    it('strips a forged inbound role header and replaces it with the real one', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: 'athlete' }, athlete_profiles: COMPLETE_ATHLETE })
      const res = await middleware(
        request('/athlete/discover', { [ROLE_HEADER]: 'admin' }),
      )
      expect(forwardedHeader(res, ROLE_HEADER)).toBe('athlete')
      expect(forwardedHeader(res, ROLE_HEADER)).not.toBe('admin')
    })

    it('strips forged x-podium-* headers even when no role is resolved', async () => {
      stubSupabase(null, {})
      const res = await middleware(
        request('/', { [ROLE_HEADER]: 'admin', 'x-podium-anything': 'spoofed' }),
      )
      expect(forwardedHeader(res, ROLE_HEADER)).toBeNull()
      expect(forwardedHeader(res, 'x-podium-anything')).toBeNull()
    })

    it('never lets a forged header satisfy the admin gate', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: 'athlete' } })
      const res = await middleware(request('/admin/dashboard', { [ROLE_HEADER]: 'admin' }))
      expect(redirectedTo(res)).toBe('/403')
    })

    it('reads the role at most once per request', async () => {
      const queries = stubSupabase(
        { id: 'u1' },
        { users: { role: 'athlete' }, athlete_profiles: COMPLETE_ATHLETE },
      )
      await middleware(request('/athlete/discover'))
      expect(queries.filter((q) => q.table === 'users')).toHaveLength(1)
    })

    it('costs no role query at all on routes that gate on neither', async () => {
      const queries = stubSupabase({ id: 'u1' }, { users: { role: 'athlete' } })
      await middleware(request('/api/auth/logout'))
      expect(queries).toHaveLength(0)
    })

    // SB-9/FA-4: no select('*') on the authenticated hot path.
    it('projects explicit columns for the onboarding gate', async () => {
      const queries = stubSupabase({ id: 'u1' }, { users: { role: 'athlete' }, athlete_profiles: null })
      await middleware(request('/athlete/discover'))
      for (const query of queries) {
        expect(query.columns, query.table).not.toBe('*')
        expect(query.columns.length, query.table).toBeGreaterThan(0)
      }
    })
  })

  // ── PR-9: resumable onboarding for non-athlete roles ─────────────────────
  describe('brand onboarding is resumable too (PR-9)', () => {
    it('sends a brand with no profile to step 1', async () => {
      stubSupabase({ id: 'u1' }, { users: { role: 'brand' }, brand_profiles: null })
      const res = await middleware(request('/brand/discover'))
      expect(redirectedTo(res)).toBe('/brand/onboarding/step/1')
    })

    // The bug: brands were sent to /brand/onboarding, which redirects to step 1,
    // so a brand three steps in restarted from scratch on every navigation.
    it('resumes a partially-complete brand at their furthest step', async () => {
      stubSupabase(
        { id: 'u1' },
        {
          users: { role: 'brand' },
          brand_profiles: {
            // The real default from the brand_status enum. This test used to say
            // 'draft', which brand_status has no value for, so it was asserting
            // against a state the database cannot produce.
            status: 'pending_approval',
            onboarding_completed_at: null,
            company_name: 'Acme',
            cover_image_url: 'https://x/cover.jpg',
            industry: 'sport',
          },
        },
      )
      const res = await middleware(request('/brand/discover'))
      expect(redirectedTo(res)).toBe('/brand/onboarding/step/3')
    })

    // The bug this replaces: brand_status is
    // ('pending_approval','active','suspended','rejected') with no 'draft', so
    // the old shared `status !== 'draft'` gate was true from the instant step 1
    // inserted the row. A brand could leave after step 1 with no industry,
    // description, sports or seeking set and never be asked to come back.
    it('keeps a brand who has only finished step 1 inside the wizard', async () => {
      stubSupabase(
        { id: 'u1' },
        {
          users: { role: 'brand' },
          brand_profiles: {
            status: 'pending_approval',
            onboarding_completed_at: null,
            company_name: 'Acme',
            cover_image_url: 'https://x/cover.jpg',
          },
        },
      )
      const res = await middleware(request('/brand/dashboard'))
      expect(redirectedTo(res)).toBe('/brand/onboarding/step/2')
    })

    it('lets a brand who submitted the final step through untouched', async () => {
      stubSupabase(
        { id: 'u1' },
        {
          users: { role: 'brand' },
          brand_profiles: {
            status: 'active',
            onboarding_completed_at: '2026-07-30T10:00:00.000Z',
            company_name: 'Acme',
          },
        },
      )
      const res = await middleware(request('/brand/discover'))
      expect(redirectedTo(res)).toBeNull()
    })

    // Awaiting admin approval is not unfinished onboarding: such a brand has to
    // be able to reach /brand/subscription.
    it('lets a brand awaiting approval through once onboarding is submitted', async () => {
      stubSupabase(
        { id: 'u1' },
        {
          users: { role: 'brand' },
          brand_profiles: {
            status: 'pending_approval',
            onboarding_completed_at: '2026-07-30T10:00:00.000Z',
            company_name: 'Acme',
          },
        },
      )
      const res = await middleware(request('/brand/subscription'))
      expect(redirectedTo(res)).toBeNull()
    })
  })

  describe('single-form roles (PR-9)', () => {
    // Team and agent onboarding have no step routes, so the form itself is the
    // only place to resume — asserted so a future step split updates both ends.
    it.each([
      ['team', '/team/discover', '/team/onboarding'],
      ['agent', '/agent/clients', '/agent/onboarding'],
    ])('sends an incomplete %s to their onboarding form', async (role, from, to) => {
      stubSupabase({ id: 'u1' }, { users: { role }, [`${role}_profiles`]: null })
      const res = await middleware(request(from))
      expect(redirectedTo(res)).toBe(to)
    })

    // The signup-breaking loop. Both flows create the row without setting
    // status, so it stayed at the 'draft' column default forever. This gate then
    // bounced every navigation back to onboarding, the onboarding page saw an
    // existing row and redirected straight back out, and the two chased each
    // other indefinitely: a real team signup produced 77+ consecutive
    // GET /team/onboarding requests after a successful POST.
    //
    // Fixed at the source (rows are created 'active'), so the state below should
    // no longer occur. Asserted anyway, because a row already stranded in draft
    // by the old code must be let through rather than trapped again, and because
    // the next single-form role added must not reintroduce the same hole.
    it.each([
      ['team', '/team/settings'],
      ['agent', '/agent/dashboard'],
    ])('lets an active %s reach the app instead of looping', async (role, destination) => {
      stubSupabase(
        { id: 'u1' },
        { users: { role }, [`${role}_profiles`]: { status: 'active' } },
      )
      const res = await middleware(request(destination))
      expect(redirectedTo(res)).toBeNull()
    })
  })
})
