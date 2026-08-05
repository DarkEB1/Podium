import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { ROUTES } from '@/lib/routes'
import {
  ONBOARDING_PROGRESS_COLUMNS,
  isOnboardingComplete,
  onboardingResumePath,
  type NavRole,
  type OnboardingProgress,
} from '@/lib/nav/config'
import { ADMIN_2FA_COOKIE, verifyAdmin2faCookie } from '@/lib/auth/admin-2fa-cookie'

// 2.4: the admin 2FA challenge/enrollment page is under /admin but must be
// reachable WITHOUT a passed challenge, or an un-verified admin could never
// obtain the cookie. Everything else under /admin requires it.
const ADMIN_2FA_PATH = '/admin/2fa'
// The general user 2FA challenge (spec §security).
const TWO_FACTOR_CHALLENGE_PATH = '/auth/2fa'

/**
 * Routes a signed-out visitor may reach. B-7/B-10: the landing nav links to
 * marketing surfaces (`/pricing`, `/terms`, `/privacy`) — leaving them out of
 * this list bounced visitors into the auth wall the moment they clicked.
 */
const PUBLIC_PATHS = [
  ROUTES.home,
  ROUTES.pricing,
  '/how-it-works',
  '/terms',
  '/privacy',
  '/cookies',
  // The contact page and its submission endpoint are for visitors without
  // accounts — behind the auth wall the form would be pointless.
  '/contact',
  '/api/contact',
  // CL-4: the one-click unsubscribe link is followed from a mail client with no
  // session; the HMAC token in the URL is its authorisation. The confirmation
  // page it redirects to must be reachable signed out too.
  '/unsubscribed',
  '/api/unsubscribe',
  // Vercel Cron calls this unauthenticated from outside the app. The matcher
  // covers /api/*, so without this entry the scheduled GDPR erasure job would
  // be redirected to /auth and silently never run. The route enforces its own
  // constant-time CRON_SECRET bearer check and fails closed.
  '/api/cron',
  // Stripe posts webhook events from its own servers with no session; the
  // routes verify the HMAC signature themselves and Stripe treats a redirect
  // as a failed delivery, so behind the auth wall every subscription event
  // is silently lost.
  '/api/webhooks',
  // A guardian follows the emailed consent link without having an account —
  // the token in the URL is the authorisation, checked by the page and the
  // accept endpoint. (The request endpoint stays session-gated.)
  '/guardian/consent',
  '/api/guardian-consent/accept',
  ROUTES.auth.signIn,
  '/auth/callback',
  '/auth/confirm',
  ROUTES.api.auth.signup,
  ROUTES.api.auth.login,
  ROUTES.api.auth.callback,
  ROUTES.api.auth.passwordReset,
]

/**
 * Routes an authenticated user may reach *before* finishing their profile
 * (PR-9). Everything else is redirected into their role's onboarding flow,
 * resumed at the furthest step they reached. Sign-out and the auth API must
 * stay reachable or an incomplete user would be trapped.
 */
const ONBOARDING_ALLOWED_PATHS = [
  '/api',
  ROUTES.auth.roleSelect,
  ROUTES.auth.updatePassword,
  ROUTES.auth.signIn,
  ROUTES.forbidden,
]

const ADMIN_PATHS = ['/admin']

const PROFILE_TABLE: Record<NavRole, string> = {
  athlete: 'athlete_profiles',
  brand: 'brand_profiles',
  team: 'team_profiles',
  agent: 'agent_profiles',
}

const NAV_ROLE_SET = new Set<string>(['athlete', 'brand', 'team', 'agent'])

/**
 * Prefix reserved for headers this middleware injects into the forwarded
 * request. Nothing outside middleware may ever set one.
 */
const PODIUM_HEADER_PREFIX = 'x-podium-'

/**
 * FA-3 / NX-6 — the role middleware resolved, forwarded to Server Components so
 * they do not re-query `public.users` for it.
 *
 * ## SECURITY — read before consuming this header
 *
 * 1. **It is a hint, never an authorisation decision.** Middleware runs on the
 *    edge with the anon key; the value it writes is only as good as the session
 *    cookie it read. Every table this app touches has RLS, and RLS remains the
 *    thing that actually decides what a request may read or write. Use this
 *    header to skip a round-trip (which nav shell to render, which dashboard to
 *    link to) — never as the sole gate on privileged data. If a query would
 *    return more rows because this header says "admin", the code is wrong.
 *
 * 2. **Inbound copies are forged copies.** A client can put any header on any
 *    request, so `x-podium-role: admin` arriving from the internet is trivial
 *    to send. `stripInboundPodiumHeaders()` deletes every `x-podium-*` header
 *    off the request before middleware sets its own, so a Server Component
 *    reading it can only ever observe a value this file wrote. Deleting the
 *    whole prefix (rather than just `x-podium-role`) means a future header
 *    added here inherits the protection instead of quietly shipping forgeable.
 *
 * Both properties are load-bearing: skip (2) and this perf fix becomes an
 * authentication bypass; skip (1) and it becomes an authorisation bypass the
 * first time a bug lets the header through.
 */
export const ROLE_HEADER = `${PODIUM_HEADER_PREFIX}role`

function stripInboundPodiumHeaders(headers: Headers): void {
  for (const key of [...headers.keys()]) {
    if (key.toLowerCase().startsWith(PODIUM_HEADER_PREFIX)) headers.delete(key)
  }
}

function matches(pathname: string, candidates: readonly string[]): boolean {
  return candidates.some((p) =>
    p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/'),
  )
}

export async function middleware(request: NextRequest) {
  // SECURITY: strip first, set later. See ROLE_HEADER above.
  const requestHeaders = new Headers(request.headers)
  stripInboundPodiumHeaders(requestHeaders)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  // Cookies Supabase asks us to refresh. Collected rather than written straight
  // onto a response, because the forwarded request headers (and therefore the
  // response object) are not final until the role is known — `NextResponse.next`
  // snapshots the header list at construction time.
  type RefreshedCookie = Parameters<
    NonNullable<Parameters<typeof createServerClient>[2]['cookies']['setAll']>
  >[0][number]
  const refreshedCookies: RefreshedCookie[] = []

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        refreshedCookies.push(...cookiesToSet)
      },
    },
  })

  /** Applies any refreshed session cookies to whatever response we return. */
  function withCookies<T extends NextResponse>(response: T): T {
    for (const { name, value, options } of refreshedCookies) {
      response.cookies.set(name, value, options ?? {})
    }
    return response
  }

  function redirectTo(pathname: string) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = pathname
    redirectUrl.search = ''
    return withCookies(NextResponse.redirect(redirectUrl))
  }

  /** Forwards the request with the resolved role attached (or no role at all). */
  function forward(role: string | null) {
    if (role) requestHeaders.set(ROLE_HEADER, role)
    return withCookies(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublic = matches(pathname, PUBLIC_PATHS)
  const isAdmin = ADMIN_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublic) {
    return redirectTo(ROUTES.auth.signIn)
  }

  if (!user) return forward(null)
  const userId = user.id

  // FA-3/NX-6: the role is read at most ONCE per request. The admin gate and
  // the PR-9 onboarding gate below both used to issue their own
  // `users.select('role')`, so an authenticated request could cost four queries
  // before any page code ran. Lazy, so routes that need neither gate (public
  // pages, /api/*) still cost zero role queries, exactly as before.
  let roleLookup: Promise<string | null> | undefined
  function resolveRole(): Promise<string | null> {
    roleLookup ??= (async () => {
      const { data } = await supabase.from('users').select('role').eq('id', userId).single()
      // The row shape is not narrowed here (the edge client is untyped), and
      // the value is validated below by NAV_ROLE_SET / the 'admin' comparison.
      return (data as { role?: string } | null)?.role ?? null
    })()
    return roleLookup
  }

  if (isAdmin) {
    if ((await resolveRole()) !== 'admin') {
      return redirectTo(ROUTES.forbidden)
    }
    // 2.4: admin pages require a 2FA challenge passed this session. The 2FA page
    // itself is exempt so the challenge (and first-time enrollment) is reachable.
    if (!pathname.startsWith(ADMIN_2FA_PATH)) {
      const cookie = request.cookies.get(ADMIN_2FA_COOKIE)?.value
      if (!(await verifyAdmin2faCookie(cookie, userId))) {
        return redirectTo(ADMIN_2FA_PATH)
      }
    }
  }

  // User-level 2FA (spec §security): a user who has enabled 2FA must pass a
  // challenge once per session before reaching the app. Cookie-first, so the
  // authoritative auth_2fa lookup only runs on the rare request without a valid
  // pass cookie (i.e. right after sign-in), not on every navigation. API routes
  // and the /auth surface are exempt so the challenge itself stays reachable.
  if (!isAdmin && !isPublic && !pathname.startsWith('/api/') && !pathname.startsWith('/auth')) {
    const passed = await verifyAdmin2faCookie(request.cookies.get(ADMIN_2FA_COOKIE)?.value, userId)
    if (!passed) {
      const { data } = await supabase
        .from('auth_2fa')
        .select('enabled')
        .eq('user_id', userId)
        .maybeSingle()
      if ((data as { enabled?: boolean } | null)?.enabled) {
        return redirectTo(TWO_FACTOR_CHALLENGE_PATH)
      }
    }
  }

  const needsOnboardingGate =
    !isAdmin && !isPublic && !matches(pathname, ONBOARDING_ALLOWED_PATHS)
  const role = isAdmin || needsOnboardingGate ? await resolveRole() : null

  // ── PR-9: profile creation is mandatory and resumable ──────────────────────
  // An authenticated user whose role profile has not been published cannot
  // reach the rest of the app; they are returned to their onboarding flow at
  // the furthest step they completed. Onboarding itself, the auth API and the
  // role step stay reachable so this can never loop.
  if (needsOnboardingGate && role && NAV_ROLE_SET.has(role)) {
    // The cast is safe: NAV_ROLE_SET holds exactly the NavRole literals.
    const navRole = role as NavRole

    // SB-9/FA-4: project only the columns the resume derivation reads instead
    // of `select('*')` — this runs on every authenticated navigation.
    const { data: profile } = await supabase
      .from(PROFILE_TABLE[navRole])
      .select(ONBOARDING_PROGRESS_COLUMNS[navRole])
      .eq('user_id', userId)
      .maybeSingle()

    // The row shape depends on the role table chosen at runtime, so the
    // generated per-table types cannot narrow it here; OnboardingProgress is
    // the all-optional union every reader in lib/nav/config.ts guards against.
    const progress = profile as (OnboardingProgress & { status?: string }) | null

    // Role-aware by necessity: the four role tables do not agree on how
    // "unfinished" is spelled, and a single shared comparison here was the root
    // cause of both the team/agent signup loop and brands escaping the wizard
    // after step 1. See isOnboardingComplete for the full account.
    const onboardingComplete = isOnboardingComplete(navRole, progress)

    // Never redirect onto the page we are already on — that is the loop.
    if (!onboardingComplete && !pathname.startsWith(`/${navRole}/onboarding`)) {
      const resumePath = onboardingResumePath(navRole, progress)
      return redirectTo(resumePath.split('?')[0] ?? resumePath)
    }
  }

  return forward(role)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
