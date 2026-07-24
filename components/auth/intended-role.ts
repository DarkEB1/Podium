import type { Database } from '@/types/database'

/** Every role a user can pick for themselves (admin is assigned, never chosen). */
export type SelectableRole = Exclude<Database['public']['Enums']['user_role'], 'admin'>

export const SELECTABLE_ROLES = ['athlete', 'team', 'brand', 'agent'] as const

/**
 * M-3 / PR-10 — where the landing-page role choice is remembered.
 *
 * The landing CTAs link to `/auth/signup?role=<role>`. Sign-up is followed by
 * an email round trip, so the query param cannot survive to `/role-select`;
 * the choice is stashed here instead and used to pre-select the role step.
 */
export const INTENDED_ROLE_STORAGE_KEY = 'podium:intended-role'

/** Narrow arbitrary input (a query param, a storage value) to a real role. */
export function parseRole(value: string | null | undefined): SelectableRole | null {
  if (!value) return null
  return (SELECTABLE_ROLES as readonly string[]).includes(value)
    ? (value as SelectableRole)
    : null
}

/** Read the remembered role, tolerating unavailable/blocked storage. */
export function readIntendedRole(): SelectableRole | null {
  try {
    return parseRole(window.localStorage.getItem(INTENDED_ROLE_STORAGE_KEY))
  } catch {
    return null
  }
}

/** Clear the remembered role once it has been consumed. */
export function clearIntendedRole(): void {
  try {
    window.localStorage.removeItem(INTENDED_ROLE_STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
