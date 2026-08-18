/**
 * ROUTES — the single source of truth for every in-app path.
 *
 * Every href in the app (nav config, middleware, auth callback, landing,
 * shells, cards) must be sourced from here rather than hand-written, so a
 * route that is renamed or removed breaks in one place instead of silently
 * 404-ing in the primary navigation.
 *
 * Static paths are plain strings; dynamic paths are functions that take their
 * segment values (e.g. `ROUTES.athlete.profile(userId)`).
 *
 * `lib/routes.test.ts` walks `app/` and asserts every static string in here
 * resolves to a real `page.tsx` / `route.ts`. That test is the regression
 * guard — add a route here only once the file exists.
 */

export type AppRole = 'athlete' | 'brand' | 'team' | 'agent'

export const ROUTES = {
  home: '/',
  /** Public marketing pricing page. */
  pricing: '/pricing',
  forbidden: '/403',
  dashboard: '/dashboard',
  /** Public confirmation shown after a one-click email unsubscribe (CL-4). */
  unsubscribed: '/unsubscribed',

  /** Cross-role settings reached from email footers (CL-4). */
  settings: {
    notifications: '/settings/notifications',
  },

  /** In-page anchors on the landing page — always reachable signed out. */
  landing: {
    howItWorks: '/#what-we-do',
  },

  auth: {
    /** The sign-in page. There is no `/login`. */
    signIn: '/auth',
    signUp: '/auth/signup',
    /** Signup pre-seeded with a role so the role step can be skipped. */
    signUpAs: (role: AppRole) => `/auth/signup?role=${role}`,
    forgotPassword: '/auth/forgot-password',
    verifyEmail: '/auth/verify-email',
    roleSelect: '/role-select',
    updatePassword: '/update-password',
  },

  api: {
    auth: {
      callback: '/api/auth/callback',
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      signup: '/api/auth/signup',
      role: '/api/auth/role',
      me: '/api/auth/me',
      passwordReset: '/api/auth/password-reset',
      passwordUpdate: '/api/auth/password-update',
    },
    discovery: {
      connections: '/api/discovery/connections',
      /** Requests addressed to the signed-in user — the accept-side feed. */
      incomingConnections: '/api/discovery/connections/incoming',
      connection: (requestId: string) => `/api/discovery/connections/${requestId}`,
      shortlist: '/api/discovery/shortlist',
      shortlistEntry: (targetUserId: string) => `/api/discovery/shortlist/${targetUserId}`,
    },
    profiles: {
      me: '/api/profiles/me',
      publish: '/api/profiles/me/publish',
      /**
       * Brands finish onboarding here rather than at `publish`: their `status`
       * is admin-controlled (pending_approval -> active on approval), so it
       * cannot also mean "the user finished the wizard".
       */
      onboardingComplete: '/api/profiles/me/onboarding-complete',
      representation: '/api/profiles/representation',
    },
  },

  athlete: {
    dashboard: '/athlete/dashboard',
    discover: '/athlete/discover',
    requests: '/athlete/requests',
    saved: '/athlete/saved',
    messages: '/athlete/messages',
    message: (matchId: string) => `/athlete/messages/${matchId}`,
    /** The signed-in athlete's own profile. */
    profile: '/athlete/profile',
    /** Any athlete's public profile, viewable cross-role. */
    profileFor: (userId: string) => `/athlete/profile/${userId}`,
    settings: '/athlete/settings',
    onboarding: '/athlete/onboarding',
    onboardingStep: (step: number) => `/athlete/onboarding/step/${step}`,
    onboardingPreview: '/athlete/onboarding/preview',
  },

  brand: {
    dashboard: '/brand/dashboard',
    discover: '/brand/discover',
    /** 2.2 — the brand-side surface for finding teams to sponsor. */
    discoverTeams: '/brand/discover/teams',
    /** Any team's public profile as a brand sees it. */
    teamProfileFor: (userId: string) => `/brand/discover/team/${userId}`,
    listings: '/brand/listings',
    listingsNew: '/brand/listings/new',
    /**
     * The brand's connection-request inbox — the ACCEPT side of the core loop.
     * Every connection request the product can currently send is addressed to a
     * brand (listing-card.tsx posts `recipient_id: brand_user_id`), so without
     * this route nothing is ever accepted and no match is ever created (B-1).
     */
    requests: '/brand/requests',
    listing: (id: string) => `/brand/listings/${id}`,
    messages: '/brand/messages',
    message: (matchId: string) => `/brand/messages/${matchId}`,
    profile: '/brand/profile',
    payments: '/brand/payments',
    subscription: '/brand/subscription',
    /** Enterprise-gated outreach analytics; non-Enterprise brands see an upsell. */
    analytics: '/brand/analytics',
    settings: '/brand/settings',
    onboarding: '/brand/onboarding',
    onboardingStep: (step: number) => `/brand/onboarding/step/${step}`,
  },

  team: {
    dashboard: '/team/dashboard',
    discover: '/team/discover',
    // 2.1 — teams can now message brands and complete deals. These mirror the
    // athlete surfaces and reuse the same role-agnostic lib functions.
    requests: '/team/requests',
    messages: '/team/messages',
    message: (matchId: string) => `/team/messages/${matchId}`,
    deals: '/team/deals',
    deal: (proposalId: string) => `/team/deals/${proposalId}`,
    profile: '/team/profile',
    settings: '/team/settings',
    onboarding: '/team/onboarding',
  },

  agent: {
    dashboard: '/agent/dashboard',
    clients: '/agent/clients',
    clientsNew: '/agent/clients/new',
    profile: '/agent/profile',
    settings: '/agent/settings',
    onboarding: '/agent/onboarding',
  },
} as const

/** Role -> the route a freshly-signed-in user of that role lands on. */
export const ROLE_DASHBOARD: Record<AppRole, string> = {
  athlete: ROUTES.athlete.dashboard,
  brand: ROUTES.brand.dashboard,
  team: ROUTES.team.dashboard,
  agent: ROUTES.agent.dashboard,
}

/** Role -> the first route of that role's onboarding flow. */
export const ROLE_ONBOARDING: Record<AppRole, string> = {
  athlete: ROUTES.athlete.onboarding,
  brand: ROUTES.brand.onboarding,
  team: ROUTES.team.onboarding,
  agent: ROUTES.agent.onboarding,
}

/**
 * Every static (non-parameterised, non-anchored) path in ROUTES, flattened.
 * Used by the route-existence regression test and by middleware's public-path
 * matching.
 */
export function staticRoutes(node: unknown = ROUTES): string[] {
  if (typeof node === 'string') {
    // Anchors point at a section of an existing page, not a route of their own.
    return node.includes('#') ? [] : [node]
  }
  if (typeof node === 'object' && node !== null) {
    return Object.values(node as Record<string, unknown>).flatMap((v) => staticRoutes(v))
  }
  return []
}
