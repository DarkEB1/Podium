import {
  Compass,
  LayoutList,
  MessageSquare,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * Shared per-role navigation config (spec §2.5). Single source of truth for the
 * role shells (`components/layout/nav-shell.tsx`, A10): exactly four top-level
 * destinations + one persistent role CTA + the mobile bottom-nav icon set +
 * the breadcrumb derivation. GL3 owns only this file; the shell imports it.
 *
 * Hrefs are role-scoped (`/<role>/...`) and target the route groups created by
 * the role pods. Icons come from `lucide-react`; never hardcode colour — the
 * shell styles active/inactive states via semantic tokens.
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
 * Exactly four top-level items per role (spec §2.5). Discover / a role-specific
 * list / Messages / Profile, except Agent whose second slot is Clients.
 */
const NAV_ITEMS: Record<NavRole, readonly NavItem[]> = {
  athlete: [
    { label: 'Discover', href: '/athlete/discover', icon: Compass },
    { label: 'Listings', href: '/athlete/requests', icon: LayoutList },
    { label: 'Messages', href: '/athlete/messages', icon: MessageSquare },
    { label: 'Profile', href: '/athlete/profile', icon: User },
  ],
  brand: [
    { label: 'Discover', href: '/brand/discover', icon: Compass },
    { label: 'Listings', href: '/brand/listings', icon: LayoutList },
    { label: 'Messages', href: '/brand/messages', icon: MessageSquare },
    { label: 'Profile', href: '/brand/profile', icon: User },
  ],
  team: [
    { label: 'Discover', href: '/team/discover', icon: Compass },
    { label: 'Listings', href: '/team/listings', icon: LayoutList },
    { label: 'Messages', href: '/team/messages', icon: MessageSquare },
    { label: 'Profile', href: '/team/profile', icon: User },
  ],
  agent: [
    { label: 'Discover', href: '/agent/discover', icon: Compass },
    { label: 'Clients', href: '/agent/clients', icon: Users },
    { label: 'Messages', href: '/agent/messages', icon: MessageSquare },
    { label: 'Profile', href: '/agent/profile', icon: User },
  ],
}

/**
 * Persistent, role-appropriate primary action (top-right on desktop). Each href
 * is role-scoped so it is unambiguous which route group it lands in.
 */
const ROLE_CTA: Record<NavRole, RoleCta> = {
  athlete: { label: 'Edit Profile', href: '/athlete/profile/edit' },
  brand: { label: 'Post a Listing', href: '/brand/listings/new' },
  team: { label: 'Post a Listing', href: '/team/listings/new' },
  agent: { label: 'Add Client', href: '/agent/clients/new' },
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
