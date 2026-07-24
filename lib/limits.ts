/**
 * Shared field bounds (PR-8 / SEC-4).
 *
 * These were previously duplicated and CONTRADICTORY: the connection-request
 * composer in `components/discovery/listing-card.tsx` demanded a message of
 * **at least** 300 characters while `lib/supabase/discovery.ts` rejected
 * anything **over** 300 — so the only message that could ever be sent was one
 * of exactly 300 characters. That is the "limit logic is backwards" field note,
 * and it silently broke the connection-request flow (PR-19).
 *
 * Product decision: the personalised message is **300 characters or fewer**.
 * A minimum is still useful (a one-word intro converts badly and reads as
 * spam) but it must be far below the maximum.
 *
 * Every layer — UI, server, and the DB CHECK constraint added in
 * `supabase/migrations/20260720001001_connection_request_message_limit.sql` —
 * must agree with the values here. The DB is the backstop; this module is the
 * single source of truth for the application layers.
 */

/** Personalised connection-request message. */
export const CONNECTION_MESSAGE_MIN = 50
export const CONNECTION_MESSAGE_MAX = 300

/** Free-text chat message. Generous — this is conversation, not an intro. */
export const CHAT_MESSAGE_MAX = 5000

/** Proposal free-text terms. */
export const PROPOSAL_TERMS_MAX = 2000

/** Short profile/bio blurbs. */
export const BIO_MAX = 1000

export interface LengthBounds {
  min: number
  max: number
}

export const CONNECTION_MESSAGE_BOUNDS: LengthBounds = {
  min: CONNECTION_MESSAGE_MIN,
  max: CONNECTION_MESSAGE_MAX,
}

/**
 * Validate a trimmed value against bounds. Returns null when valid, otherwise a
 * user-facing message. Shared so the UI and the server produce identical copy.
 */
export function checkLength(value: string, bounds: LengthBounds, fieldLabel: string): string | null {
  const length = value.trim().length
  if (length < bounds.min) {
    return `${fieldLabel} must be at least ${bounds.min} characters`
  }
  if (length > bounds.max) {
    return `${fieldLabel} must be ${bounds.max} characters or fewer`
  }
  return null
}
