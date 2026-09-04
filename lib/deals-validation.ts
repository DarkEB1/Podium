/**
 * Shared validation for proposal / counter economic terms (WS-DEAL-04, DP-5,
 * DP-10). One module so the API routes and the composer form cannot drift.
 *
 * Three fields were reaching the database (and Stripe) unvalidated:
 *
 *   * `pay_currency` — any 3-char string. A non-ISO code makes
 *     `Intl.NumberFormat` throw `RangeError` during server render, 500-ing
 *     `/brand/deals` and `/athlete/deals` for BOTH parties, and Stripe rejects
 *     an unsupported code with an uncaught error. Only GBP/USD/EUR are billable.
 *
 *   * `pay_amount` — "any positive number". £0.01 renders as "£0" and is below
 *     Stripe's floor; 1e15 exceeds Stripe's max; 12.345 has sub-penny precision
 *     Stripe silently rounds. Bounded to a sane 2-decimal range here.
 *
 *   * timeline dates — end-before-start, past, and malformed dates all accepted,
 *     the last surfacing as raw Postgres 22007 text in a 422.
 */

/** The only currencies Podium can bill in (Stripe + the deal surfaces). */
export const SUPPORTED_CURRENCIES = ['GBP', 'USD', 'EUR'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

/**
 * Uppercase and validate a currency code. Returns the canonical uppercase code,
 * or null when it is not one Podium supports.
 */
export function normaliseCurrency(raw: string | null | undefined): SupportedCurrency | null {
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
    ? (code as SupportedCurrency)
    : null
}

/** Stripe's practical floor/ceiling for a single deal, in major units. */
export const PROPOSAL_AMOUNT_MIN = 1
export const PROPOSAL_AMOUNT_MAX = 1_000_000

/**
 * Validate a proposal pay amount. Returns null when valid, otherwise a
 * user-facing message. Rejects non-finite values, out-of-range values, and
 * anything with more than two decimal places (sub-penny precision Stripe would
 * silently round).
 */
export function validatePayAmount(amount: unknown): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return 'Amount must be a number'
  }
  if (amount < PROPOSAL_AMOUNT_MIN) {
    return `Amount must be at least ${PROPOSAL_AMOUNT_MIN}`
  }
  if (amount > PROPOSAL_AMOUNT_MAX) {
    return `Amount must be ${PROPOSAL_AMOUNT_MAX.toLocaleString()} or less`
  }
  // Two-decimal check with a float-safe epsilon: 49.99 * 100 is 4998.9999… in
  // IEEE-754, so an exact `=== amount * 100` comparison would wrongly reject it.
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return 'Amount cannot have more than two decimal places'
  }
  return null
}

/** A date-only ISO string, `YYYY-MM-DD`. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True when the value is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(time)) return false
  // Reject rollovers Date.parse tolerates (e.g. 2026-02-30 → 2026-03-02).
  return new Date(time).toISOString().slice(0, 10) === value
}

/**
 * Validate an optional timeline pair. Empty / whitespace values count as absent.
 * Returns null when valid, otherwise a user-facing message. ISO date strings
 * compare lexically the same as chronologically, so end >= start is a string
 * comparison.
 */
export function validateTimeline(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const s = start?.trim() || null
  const e = end?.trim() || null
  if (s && !isIsoDate(s)) return 'Start date is not a valid date'
  if (e && !isIsoDate(e)) return 'End date is not a valid date'
  if (s && e && e < s) return 'End date cannot be before the start date'
  return null
}

/** Empty / whitespace-only timeline strings become null (never `''`). */
export function normaliseTimeline(value: string | null | undefined): string | null {
  return value?.trim() || null
}
