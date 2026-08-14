import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Brand analytics reads (outreach funnel, response/acceptance rates, aggregate
 * reach of connected athletes, listings summary, daily time-series).
 *
 * Per-listing engagement is intentionally omitted: `connection_requests` and
 * `messages` have no `listing_id`, so there is no link from a listing to the
 * outreach it generated. v1 is brand-wide only.
 */

type Client = SupabaseClient<Database>
const AUDIENCE_KEYS = ['instagram_followers', 'tiktok_followers', 'youtube_subscribers', 'twitter_followers']

/** Reach for one athlete = the largest single-platform follower/subscriber count on file. */
export function audienceOf(social: unknown): number {
  if (!social || typeof social !== 'object') return 0
  const rec = social as Record<string, unknown>
  let max = 0
  for (const k of AUDIENCE_KEYS) {
    const raw = rec[k]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return max
}

interface ReqRow {
  status: string
  responded_at?: string | null
  created_at?: string
}

/** Outreach funnel counts and derived rates over a set of connection-request rows. */
export function computeFunnel(rows: ReqRow[], messaged: number) {
  const requestsSent = rows.length
  const accepted = rows.filter((r) => r.status === 'accepted').length
  const declined = rows.filter((r) => r.status === 'declined').length
  const responded = rows.filter((r) => r.responded_at != null).length
  return {
    funnel: { requestsSent, accepted, declined, responded, messaged },
    acceptanceRate: requestsSent === 0 ? 0 : accepted / requestsSent,
    responseRate: requestsSent === 0 ? 0 : responded / requestsSent,
  }
}

/** Daily bucketed request volume, keyed by UTC calendar day, sorted ascending. */
export function buildTimeSeries(rows: ReqRow[]): Array<{ date: string; requestsSent: number; accepted: number }> {
  const byDay = new Map<string, { requestsSent: number; accepted: number }>()
  for (const r of rows) {
    const date = (r.created_at ?? '').slice(0, 10)
    if (!date) continue
    const cur = byDay.get(date) ?? { requestsSent: 0, accepted: 0 }
    cur.requestsSent += 1
    if (r.status === 'accepted') cur.accepted += 1
    byDay.set(date, cur)
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))
}

export interface BrandAnalytics {
  periodStart: string
  periodEnd: string
  funnel: { requestsSent: number; accepted: number; declined: number; responded: number; messaged: number }
  acceptanceRate: number
  responseRate: number
  connectedAthletes: number
  reachAudience: number
  listings: { active: number; total: number }
  timeSeries: Array<{ date: string; requestsSent: number; accepted: number }>
}

/**
 * Brand-wide analytics for the dashboard: outreach sent by this brand in
 * [periodStart, periodEnd], all-time accepted connections for reach, and a
 * listings summary. `brandUserId` is `users.id` (connection_requests.sender_id
 * and messages.sender_id both key off the user, not the brand profile);
 * `brandProfileId` is `brand_profiles.id` (job_listings.brand_id keys off the
 * profile, not the user).
 */
export async function getBrandAnalytics(
  c: Client,
  brandUserId: string,
  brandProfileId: string,
  periodStart: string,
  periodEnd: string
): Promise<BrandAnalytics> {
  // Cast drops the Database generic to avoid the deep PostgREST chain-type
  // inference that makes this file's build time explode (same idiom as
  // lib/supabase/admin-insights.ts and the discovery/connections modules).
  const db = c as SupabaseClient

  // 1. Requests sent in-period (funnel + time-series)
  const { data: reqs, error: reqErr } = await db
    .from('connection_requests')
    .select('status, responded_at, created_at, recipient_id')
    .eq('sender_id', brandUserId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd)
  if (reqErr) throw reqErr
  const reqRows = (reqs ?? []) as Array<ReqRow & { recipient_id: string }>

  // 2. Distinct matches messaged in-period
  const { data: msgs, error: msgErr } = await db
    .from('messages')
    .select('match_id')
    .eq('sender_id', brandUserId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd)
  if (msgErr) throw msgErr
  const messaged = new Set((msgs ?? []).map((m: { match_id: string }) => m.match_id)).size

  // 3. Reach: all-time accepted connections -> athlete audience
  const { data: accepted, error: accErr } = await db
    .from('connection_requests')
    .select('recipient_id')
    .eq('sender_id', brandUserId)
    .eq('status', 'accepted')
  if (accErr) throw accErr
  const athleteUserIds = [...new Set((accepted ?? []).map((r: { recipient_id: string }) => r.recipient_id))]
  let reachAudience = 0
  if (athleteUserIds.length > 0) {
    const { data: profiles, error: profErr } = await db
      .from('athlete_profiles')
      .select('social_accounts')
      .in('user_id', athleteUserIds)
    if (profErr) throw profErr
    reachAudience = (profiles ?? []).reduce(
      (sum: number, p: { social_accounts: unknown }) => sum + audienceOf(p.social_accounts),
      0
    )
  }

  // 4. Listings summary
  const { count: totalListings } = await db
    .from('job_listings')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandProfileId)
  const { count: activeListings } = await db
    .from('job_listings')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandProfileId)
    .eq('status', 'active')

  const { funnel, acceptanceRate, responseRate } = computeFunnel(reqRows, messaged)
  return {
    periodStart,
    periodEnd,
    funnel,
    acceptanceRate,
    responseRate,
    connectedAthletes: athleteUserIds.length,
    reachAudience,
    listings: { active: activeListings ?? 0, total: totalListings ?? 0 },
    timeSeries: buildTimeSeries(reqRows),
  }
}
