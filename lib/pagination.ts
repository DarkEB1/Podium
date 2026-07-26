/**
 * URL-driven "load more" paging for server-rendered feeds (FA-5).
 *
 * The discover pages are Server Components, so paging lives in the URL rather
 * than in client state: `?show=48` renders 48 rows and links to `?show=72`.
 * That keeps data fetching on the server (no new API surface), works without
 * JavaScript, and gives every truncated list a visible affordance — a capped
 * list with no way to see the rest is a data-loss bug in disguise.
 */

/**
 * Clamp a `?show=` query value to a whole number of pages within a hard ceiling.
 * Anything unparseable, negative or oversized falls back to one page.
 */
export function parseShowParam(
  raw: string | string[] | undefined,
  pageSize: number,
  maxRows: number = pageSize * 10
): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < pageSize) return pageSize
  // Round up to a page boundary so "load more" steps stay even.
  const rounded = Math.ceil(parsed / pageSize) * pageSize
  return Math.min(rounded, maxRows)
}
