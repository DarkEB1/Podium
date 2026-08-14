import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getSenderDisplayNames } from '@/lib/supabase/connections'
import { TIER_NAMES, isTier } from '@/lib/entitlements'

/**
 * Shared name / URL / formatting helpers for wiring domain events to the
 * transactional email layer (lib/email).
 *
 * This module deliberately holds NO Supabase queries of its own — the one bit of
 * data access it needs (resolving a display name across the four role-profile
 * tables) is delegated to the existing `getSenderDisplayNames` accessor in
 * `lib/supabase/connections.ts`, so the "no Supabase calls outside lib/supabase/"
 * rule is respected and the profile tables are probed in exactly one place.
 */

/** Greeting fallback when a user has no resolvable profile display name. */
export const FALLBACK_RECIPIENT_NAME = 'there'
/** Third-party fallback (the sender / counterparty) when their name is unknown. */
export const FALLBACK_OTHER_NAME = 'Someone'

/**
 * Absolute URL for an email deep-link. Emails render outside the app origin, so
 * every href must be absolute. Mirrors the base resolution `lib/email/index.ts`
 * uses for its footer links (NEXT_PUBLIC_APP_URL, then NEXT_PUBLIC_SITE_URL).
 */
export function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

/**
 * Display names for a set of user ids, keyed by id. Thin pass-through to the
 * existing four-role resolver so callers never re-query the profile tables.
 * Pass the SERVICE-ROLE client — sends are cross-user (and webhook-driven, with
 * no session), so RLS-scoped clients would resolve nothing.
 */
export async function resolveDisplayNames(
  admin: SupabaseClient<Database>,
  userIds: readonly string[]
): Promise<Record<string, string>> {
  return getSenderDisplayNames(admin, userIds)
}

/** One name from a resolved map, with a fallback so template data is never blank. */
export function nameOf(
  names: Record<string, string>,
  userId: string,
  fallback: string = FALLBACK_RECIPIENT_NAME
): string {
  return names[userId] ?? fallback
}

/** Subscription tier number -> human label, from the shared tier config (lib/entitlements). */
export function tierName(tier: number): string {
  return isTier(tier) ? TIER_NAMES[tier] : `Tier ${tier}`
}

/**
 * Format a Stripe minor-unit amount (e.g. pence) plus an ISO currency code for
 * an email body, e.g. `(123400, 'GBP')` -> `£1,234.00`. Falls back to
 * `<CODE> 1,234.00` for a currency `Intl` cannot symbolise. Assumes a
 * two-decimal (minor-unit) currency, which every currency Podium bills in is.
 */
export function formatAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100
  const code = currency.toUpperCase()
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(major)
  } catch {
    return `${code} ${major.toFixed(2)}`
  }
}
