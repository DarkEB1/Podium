import { ROUTES, type AppRole } from '@/lib/routes'

/**
 * Role-correct in-app destinations for a notification / email CTA (WS-MSG D20).
 *
 * Every messaging/deal email used to deep-link to `/dashboard` while its button
 * read "Review request", "Open conversation", "View proposal", "Review
 * contract" or "View payment" — the link never matched the promise. These pure
 * helpers turn the RECIPIENT's role (resolved by the caller via
 * `getUserRole`) plus the relevant id into the page the button actually names.
 *
 * The same URL is reused as the in-app notification's `metadata.url`, so the
 * bell row and the email CTA land in the same place.
 *
 * A null/unknown role (or a role with no such surface — an agent has no
 * requests inbox) falls back to `/dashboard`, which is never wrong, only
 * generic. No Supabase access here: the role is resolved once, upstream.
 */

const HAS_MESSAGES: ReadonlySet<AppRole> = new Set(['athlete', 'brand', 'team'])
const HAS_DEALS: ReadonlySet<AppRole> = new Set(['athlete', 'brand', 'team'])

/** The recipient's connection-request inbox ("Review request"). */
export function requestsInboxPath(role: AppRole | null): string {
  if (role === 'athlete') return ROUTES.athlete.requests
  if (role === 'brand') return ROUTES.brand.requests
  if (role === 'team') return ROUTES.team.requests
  return ROUTES.dashboard
}

/** The recipient's conversations inbox ("Open conversation"). */
export function messagesInboxPath(role: AppRole | null): string {
  if (role === 'athlete') return ROUTES.athlete.messages
  if (role === 'brand') return ROUTES.brand.messages
  if (role === 'team') return ROUTES.team.messages
  return ROUTES.dashboard
}

/** A specific conversation ("New message"). */
export function messageThreadPath(role: AppRole | null, matchId: string): string {
  if (role && HAS_MESSAGES.has(role)) return `/${role}/messages/${matchId}`
  return ROUTES.dashboard
}

/** A specific deal ("View proposal" / "Review contract"). */
export function dealDetailPath(role: AppRole | null, proposalId: string): string {
  if (role && HAS_DEALS.has(role)) return `/${role}/deals/${proposalId}`
  return ROUTES.dashboard
}

/** The recipient's deals list ("View payment"; payees have no payments page). */
export function dealsListPath(role: AppRole | null): string {
  if (role && HAS_DEALS.has(role)) return `/${role}/deals`
  return ROUTES.dashboard
}
