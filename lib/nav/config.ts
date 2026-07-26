import {
  Compass,
  LayoutDashboard,
  Inbox,
  MessageSquare,
  Settings,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { ROUTES } from '@/lib/routes'

/**
 * Shared per-role navigation config (spec §2.5). Single source of truth for the
 * role shells (`components/layout/nav-shell.tsx`, A10): exactly four top-level
 * destinations + one persistent role CTA + the mobile bottom-nav icon set +
 * the breadcrumb derivation. GL3 owns only this file; the shell imports it.
 *
 * Every href comes from `lib/routes.ts` and therefore corresponds to a real
 * page — `lib/routes.test.ts` enforces that, and `config.test.ts` enforces
 * that nav labels match their destinations (B-4/B-6: a nav item labelled
 * "Listings" that actually opened `/athlete/requests` made connection
 * requests unreachable).
 */

export type NavRole = 'athlete' | 'brand' | 'team' | 'agent'

export const NAV_ROLES = ['athlete', 'brand', 'team', 'agent'] as const satisfies readonly NavRole[]

export interface NavItem {
  /** Visible label — always rendered as text, never icon-alone (§9.4). */
  label: string
  /** Role-scoped destination, e.g. `/athlete/discover`. */
  href: string
  /** Bottom-nav / accessibility-decorative icon. */
  icon: LucideIcon
}

export interface RoleCta {
  label: string
  href: string
}

export interface Breadcrumb {
  label: string
  href: string
}

/**
 * Exactly four top-level items per role (spec §2.5). Teams and agents have no
 * messaging or listing surfaces yet, so their fourth/second slots point at the
 * real destinations they do have rather than at 404s.
 *
 * The four slots are a hard budget: adding a destination always costs one. See
 * the brand block below for the B-1 trade-off (Listings → Requests) and its
 * justification. Teams and agents deliberately have NO Requests slot: nothing
 * in the product can currently address a connection request to a team or agent
 * user, so an inbox for them would be permanently empty and would displace a
 * destination that is actually reachable.
 */
const NAV_ITEMS: Record<NavRole, readonly NavItem[]> = {
  athlete: [
    { label: 'Discover', href: ROUTES.athlete.discover, icon: Compass },
    // Label matches the destination so athletes can find and accept incoming
    // connection requests (B-6/UX-2).
    { label: 'Requests', href: ROUTES.athlete.requests, icon: Inbox },
    { label: 'Messages', href: ROUTES.athlete.messages, icon: MessageSquare },
    { label: 'Profile', href: ROUTES.athlete.profile, icon: User },
  ],
  brand: [
    { label: 'Discover', href: ROUTES.brand.discover, icon: Compass },
    // B-1: every connection request the product can send is addressed to a
    // brand, and acceptance is what fires the match trigger — so without a
    // Requests slot here the core loop never closes. It displaces "Listings",
    // which is the only one of the four with two other entry points: the
    // persistent brand CTA ("Post a Listing" → /brand/listings/new) and the
    // dashboard's "Manage listings" link. Profile and Messages have no other
    // entry point in the shell, so neither could be given up.
    { label: 'Requests', href: ROUTES.brand.requests, icon: Inbox },
    { label: 'Messages', href: ROUTES.brand.messages, icon: MessageSquare },
    { label: 'Profile', href: ROUTES.brand.profile, icon: User },
  ],
  team: [
    { label: 'Discover', href: ROUTES.team.discover, icon: Compass },
    { label: 'Dashboard', href: ROUTES.team.dashboard, icon: LayoutDashboard },
    { label: 'Profile', href: ROUTES.team.profile, icon: User },
    { label: 'Settings', href: ROUTES.team.settings, icon: Settings },
  ],
  agent: [
    { label: 'Dashboard', href: ROUTES.agent.dashboard, icon: LayoutDashboard },
    { label: 'Clients', href: ROUTES.agent.clients, icon: Users },
    { label: 'Profile', href: ROUTES.agent.profile, icon: User },
    { label: 'Settings', href: ROUTES.agent.settings, icon: Settings },
  ],
}

/**
 * Persistent, role-appropriate primary action (top-right on desktop). Each href
 * is role-scoped so it is unambiguous which route group it lands in.
 */
const ROLE_CTA: Record<NavRole, RoleCta> = {
  // Athletes and teams edit their profile from Settings — that page hosts the
  // profile form, so the CTA points there rather than at a non-existent
  // `/athlete/profile/edit`.
  athlete: { label: 'Edit Profile', href: ROUTES.athlete.settings },
  brand: { label: 'Post a Listing', href: ROUTES.brand.listingsNew },
  team: { label: 'Edit Profile', href: ROUTES.team.settings },
  agent: { label: 'Add Client', href: ROUTES.agent.clientsNew },
}

/** The four top-level destinations for a role. */
export function navItemsForRole(role: NavRole): readonly NavItem[] {
  return NAV_ITEMS[role]
}

/** The single persistent CTA for a role. */
export function ctaForRole(role: NavRole): RoleCta {
  return ROLE_CTA[role]
}

/**
 * Mobile bottom navigation = the same four top-level destinations rendered as
 * icon+label tabs. Kept as a dedicated accessor so the shell never duplicates
 * the item list and the two stay in lockstep.
 */
export function bottomNavForRole(role: NavRole): readonly NavItem[] {
  return NAV_ITEMS[role]
}

/** Active when the pathname equals the href or is a descendant of it. */
export function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** `edit-profile` -> `Edit Profile`. */
export function humaniseSegment(segment: string): string {
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Breadcrumb trail derived from a pathname, each crumb carrying the cumulative
 * href so every ancestor is navigable. Root (`/`) yields no crumbs.
 */
export function buildBreadcrumbs(pathname: string): Breadcrumb[] {
  const segments = pathname.split('/').filter(Boolean)
  return segments.map((segment, i) => ({
    label: humaniseSegment(segment),
    href: `/${segments.slice(0, i + 1).join('/')}`,
  }))
}

/**
 * PR-9 — onboarding resumption.
 *
 * Onboarding progress is not stored as a step number anywhere: it is implied by
 * which profile columns are populated, so the furthest step is derived from the
 * draft row itself.
 *
 * Two of the four roles genuinely have a multi-step wizard with addressable
 * step routes (`/{role}/onboarding/step/[step]`) — athlete (6 steps) and brand
 * (4 steps). Team and agent onboarding are *single forms* with no step routes
 * and no per-step persistence; see `roleResumeStep` below for what "resume"
 * honestly means for them.
 */

/** Columns of `athlete_profiles` that imply step completion. */
export interface AthleteOnboardingProgress {
  display_name?: string | null
  home_country?: string | null
  profile_photo_url?: string | null
  primary_sport?: string | null
  availability_status?: string | null
  social_accounts?: unknown
  notable_achievements?: string | null
}

/** Columns of `brand_profiles` that imply step completion. */
export interface BrandOnboardingProgress {
  company_name?: string | null
  cover_image_url?: string | null
  industry?: string | null
  target_level?: string | null
  geographic_preference?: string | null
  target_sports?: readonly string[] | null
  seeking?: readonly string[] | null
  description?: string | null
}

/**
 * Any onboarding draft row. The middleware reads one row without knowing which
 * role's table it came from, so the per-role shapes are unioned rather than
 * discriminated — every field is optional and every reader guards.
 */
export type OnboardingProgress = AthleteOnboardingProgress & BrandOnboardingProgress

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

/** Furthest step an athlete reached (1-based; step 6 is review & publish). */
export function athleteResumeStep(profile: AthleteOnboardingProgress | null): number {
  if (!profile) return 1
  // Step 1 gates on the three mandatory basics (display name, country, photo).
  if (!profile.display_name || !profile.home_country || !profile.profile_photo_url) return 1
  if (!profile.primary_sport) return 2
  if (!profile.availability_status) return 3
  const social = profile.social_accounts
  const hasSocial =
    typeof social === 'object' && social !== null && Object.keys(social as object).length > 0
  if (!hasSocial && !profile.notable_achievements) return 4
  return 6
}

/**
 * Furthest step a brand reached (1-based; step 4 is review & submit).
 *
 * Mirrors the four panes of `components/brand/brand-profile-form.tsx`:
 *   1 Company basics — company_name + cover image (both hard-required there)
 *   2 Targeting      — industry / level / geography / sports / seeking
 *   3 About          — description
 *   4 Review & submit
 *
 * Step 2's fields are individually optional in the form's schema, so "reached
 * step 3" is inferred from *any* targeting column being populated rather than
 * from one nominated column — otherwise a brand who filled in only
 * `target_sports` would be bounced back to a screen they had already completed.
 */
export function brandResumeStep(profile: BrandOnboardingProgress | null): number {
  if (!profile) return 1
  if (!profile.company_name || !profile.cover_image_url) return 1
  const hasTargeting =
    isNonEmpty(profile.industry) ||
    isNonEmpty(profile.target_level) ||
    isNonEmpty(profile.geographic_preference) ||
    isNonEmpty(profile.target_sports) ||
    isNonEmpty(profile.seeking)
  if (!hasTargeting) return 2
  if (!isNonEmpty(profile.description)) return 3
  return 4
}

/**
 * Number of addressable onboarding steps per role. `null` means the role's
 * onboarding is a single form with no `step/[step]` route — there is no step to
 * resume at, so the resume path is the form itself.
 */
export const ONBOARDING_STEPS: Record<NavRole, number | null> = {
  athlete: 6,
  brand: 4,
  // Team onboarding is one form (`app/(team)/team/onboarding/page.tsx` →
  // `components/team/team-profile-form.tsx`). It persists only on submit, via a
  // single `createTeamProfile` call, so there is no partial row to derive a
  // step from. Returning to the form IS the resume: it rehydrates from whatever
  // draft row exists (logo/cover), and no further granularity is available
  // without splitting the wizard into step routes first.
  team: null,
  // Agent onboarding is likewise one form, and stricter still: the page
  // redirects to the agent profile the moment an `agent_profiles` row exists,
  // so a partial draft is never even representable. Nothing to resume.
  agent: null,
}

/**
 * Furthest step reached for any role, or `null` for roles whose onboarding has
 * no addressable steps.
 */
export function roleResumeStep(
  role: NavRole,
  profile: OnboardingProgress | null,
): number | null {
  if (role === 'athlete') return athleteResumeStep(profile)
  if (role === 'brand') return brandResumeStep(profile)
  return null
}

/**
 * The route an authenticated user with an incomplete profile must be sent to,
 * resuming where they left off rather than restarting (PR-9).
 */
export function onboardingResumePath(
  role: NavRole,
  profile: OnboardingProgress | null,
): string {
  const step = roleResumeStep(role, profile)
  if (role === 'athlete') return ROUTES.athlete.onboardingStep(step ?? 1)
  if (role === 'brand') return ROUTES.brand.onboardingStep(step ?? 1)
  if (role === 'team') return ROUTES.team.onboarding
  return ROUTES.agent.onboarding
}

/**
 * The profile columns middleware must project to derive a resume path for a
 * role — replaces `select('*')` on the auth hot path (SB-9/FA-4). `status` is
 * always included: it is what decides whether onboarding is finished at all.
 */
export const ONBOARDING_PROGRESS_COLUMNS: Record<NavRole, string> = {
  athlete:
    'status, display_name, home_country, profile_photo_url, primary_sport, availability_status, social_accounts, notable_achievements',
  brand:
    'status, company_name, cover_image_url, industry, target_level, geographic_preference, target_sports, seeking, description',
  // Single-form roles need nothing beyond the completion flag.
  team: 'status',
  agent: 'status',
}
