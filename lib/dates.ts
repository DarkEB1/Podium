/**
 * Date formatting for deal surfaces (DP-18).
 *
 * `proposals.timeline_start` / `timeline_end` are date-only ISO strings
 * (`YYYY-MM-DD`). Passing one to `new Date(...).toLocaleDateString()` parses it
 * as UTC midnight, so every viewer west of UTC saw the PREVIOUS day, and the
 * three deal screens each formatted it differently (raw ISO here, locale there).
 *
 * `formatDate` formats a date-only string WITHOUT constructing a zoned Date, so
 * the day can never shift, and every surface renders it identically.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Format a date-only ISO string (`YYYY-MM-DD`) as `1 Jun 2026`. Returns the
 * input unchanged if it is not a plain date string, so a full timestamp or an
 * already-formatted value is never mangled.
 */
export function formatDate(dateOnly: string | null | undefined): string {
  if (!dateOnly) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly)
  if (!m) return dateOnly
  const [, year, month, day] = m
  const monthIndex = Number(month) - 1
  if (monthIndex < 0 || monthIndex > 11) return dateOnly
  return `${Number(day)} ${MONTHS[monthIndex]} ${year}`
}

/** Format an optional timeline pair as `1 Jun 2026 → 31 Aug 2026`. */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  const s = formatDate(start)
  const e = formatDate(end)
  if (s && e) return `${s} → ${e}`
  return s || e
}
