import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Read-only admin insight queries (spec §admin): revenue, subscriptions and
 * platform analytics. Service-role only. Sums are computed in JS over a bounded
 * recent window rather than via an RPC, which is fine at launch scale; swap for
 * a materialised aggregate if payment volume grows large.
 */

type PaymentRow = Database['public']['Tables']['payments']['Row']
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

async function count(
  admin: SupabaseClient<Database>,
  table: string,
  eqFilter?: { column: string; value: unknown }
): Promise<number> {
  let q = (admin as SupabaseClient).from(table).select('*', { count: 'exact', head: true })
  if (eqFilter) q = q.eq(eqFilter.column, eqFilter.value)
  const { count: n } = await q
  return n ?? 0
}

export interface RevenueOverview {
  totalGross: number
  totalPlatformFees: number
  totalNet: number
  byStatus: Record<string, { count: number; gross: number }>
  recent: PaymentRow[]
}

export async function getRevenueOverview(admin: SupabaseClient<Database>): Promise<RevenueOverview> {
  const { data } = await (admin as SupabaseClient)
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = (data as PaymentRow[] | null) ?? []
  const byStatus: Record<string, { count: number; gross: number }> = {}
  let totalGross = 0
  let totalPlatformFees = 0
  let totalNet = 0

  for (const p of rows) {
    const gross = Number(p.amount) || 0
    totalGross += gross
    totalPlatformFees += Number(p.platform_fee) || 0
    totalNet += Number(p.net_amount) || 0
    const s = p.status ?? 'unknown'
    byStatus[s] ??= { count: 0, gross: 0 }
    byStatus[s].count++
    byStatus[s].gross += gross
  }

  return { totalGross, totalPlatformFees, totalNet, byStatus, recent: rows.slice(0, 50) }
}

export interface SubscriptionOverview {
  total: number
  byTier: Record<number, number>
  byStatus: Record<string, number>
  recent: SubscriptionRow[]
}

export async function getSubscriptionOverview(
  admin: SupabaseClient<Database>
): Promise<SubscriptionOverview> {
  const { data } = await (admin as SupabaseClient)
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = (data as SubscriptionRow[] | null) ?? []
  const byTier: Record<number, number> = {}
  const byStatus: Record<string, number> = {}
  for (const s of rows) {
    byTier[s.tier] = (byTier[s.tier] ?? 0) + 1
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
  }
  return { total: rows.length, byTier, byStatus, recent: rows.slice(0, 50) }
}

export interface PlatformAnalytics {
  athletes: number
  brands: number
  teams: number
  agents: number
  activeListings: number
  contracts: number
  matches: number
  pendingReports: number
  pendingVerifications: number
}

export async function getPlatformAnalytics(
  admin: SupabaseClient<Database>
): Promise<PlatformAnalytics> {
  const [athletes, brands, teams, agents, activeListings, contracts, matches, pendingReports, pendingVerifications] =
    await Promise.all([
      count(admin, 'athlete_profiles'),
      count(admin, 'brand_profiles'),
      count(admin, 'team_profiles'),
      count(admin, 'agent_profiles'),
      count(admin, 'job_listings', { column: 'status', value: 'active' }),
      count(admin, 'contracts'),
      count(admin, 'matches'),
      count(admin, 'reports', { column: 'status', value: 'pending' }),
      count(admin, 'verification_requests', { column: 'status', value: 'pending' }),
    ])

  return { athletes, brands, teams, agents, activeListings, contracts, matches, pendingReports, pendingVerifications }
}
