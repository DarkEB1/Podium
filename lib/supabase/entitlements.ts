import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { ENTITLEMENTS, isTier, type Tier } from '@/lib/entitlements'

type Role = Database['public']['Tables']['users']['Row']['role']
type Client = SupabaseClient<Database>

const ACTIVE_STATUSES = new Set(['active', 'trialing'])
type Capability = 'requests' | 'listings' | 'messages'

export interface EntitlementCheck {
  allowed: boolean
  gated: boolean // true only when the actor is a subscription-gated brand
  tier: Tier | null
  limit: number | null // null = unlimited
  used: number
  reason?: 'NO_SUBSCRIPTION' | 'LIMIT_REACHED'
}

const UNGATED: EntitlementCheck = { allowed: true, gated: false, tier: null, limit: null, used: 0 }

// cast drops the Database generic to avoid deep PostgREST inference (matches lib/supabase/* idiom)
async function countSince(c: Client, table: 'connection_requests' | 'messages', userId: string, sinceIso: string): Promise<number> {
  const { count, error } = await (c as SupabaseClient)
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', userId)
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

async function countActiveListings(c: Client, brandProfileId: string): Promise<number> {
  const { count, error } = await (c as SupabaseClient)
    .from('job_listings')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandProfileId)
    .eq('status', 'active')
  if (error) throw error
  return count ?? 0
}

async function check(c: Client, userId: string, role: Role, capability: Capability): Promise<EntitlementCheck> {
  if (role !== 'brand') return UNGATED
  const sub = await getSubscriptionForUser(c, userId)
  if (!sub || !ACTIVE_STATUSES.has(sub.status)) {
    return { allowed: false, gated: true, tier: null, limit: null, used: 0, reason: 'NO_SUBSCRIPTION' }
  }
  const tier: Tier = isTier(sub.tier) ? sub.tier : 1
  const limit = ENTITLEMENTS[tier][capability]
  if (limit === null) return { allowed: true, gated: true, tier, limit: null, used: 0 }
  const used =
    capability === 'requests'
      ? await countSince(c, 'connection_requests', userId, sub.current_period_start)
      : capability === 'messages'
        ? await countSince(c, 'messages', userId, sub.current_period_start)
        : await countActiveListings(c, sub.brand_id)
  return {
    allowed: used < limit,
    gated: true,
    tier,
    limit,
    used,
    ...(used < limit ? {} : { reason: 'LIMIT_REACHED' as const }),
  }
}

export const assertCanSendConnectionRequest = (c: Client, userId: string, role: Role) => check(c, userId, role, 'requests')
export const assertCanCreateListing = (c: Client, userId: string, role: Role) => check(c, userId, role, 'listings')
export const assertCanSendMessage = (c: Client, userId: string, role: Role) => check(c, userId, role, 'messages')

export interface EntitlementUsage {
  tier: Tier
  analytics: boolean
  requests: { limit: number | null; used: number }
  listings: { limit: number | null; used: number }
  messages: { limit: number | null; used: number }
}

export async function getEntitlementUsage(c: Client, userId: string): Promise<EntitlementUsage | null> {
  const sub = await getSubscriptionForUser(c, userId)
  if (!sub || !ACTIVE_STATUSES.has(sub.status)) return null
  const tier: Tier = isTier(sub.tier) ? sub.tier : 1
  const e = ENTITLEMENTS[tier]
  const [requests, messages, listings] = await Promise.all([
    e.requests === null ? Promise.resolve(0) : countSince(c, 'connection_requests', userId, sub.current_period_start),
    e.messages === null ? Promise.resolve(0) : countSince(c, 'messages', userId, sub.current_period_start),
    e.listings === null ? Promise.resolve(0) : countActiveListings(c, sub.brand_id),
  ])
  return {
    tier,
    analytics: e.analytics,
    requests: { limit: e.requests, used: requests },
    listings: { limit: e.listings, used: listings },
    messages: { limit: e.messages, used: messages },
  }
}
