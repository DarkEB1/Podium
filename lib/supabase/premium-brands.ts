import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Which of the given brand user_ids are on an active/trialing top-tier
 * (Unlimited) subscription. Backs the two athlete-visible plan perks: the
 * Verified brand badge and the Featured rail (lib/discovery/featured.ts).
 *
 * Goes through the `premium_brand_user_ids` SECURITY DEFINER function because
 * `subscriptions` is not readable across users under RLS. The function only
 * ever answers for the ids it is handed, so pass the page's brands, not "all".
 */
export async function getPremiumBrandUserIds(
  supabase: SupabaseClient<Database>,
  userIds: (string | null | undefined)[]
): Promise<Set<string>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)))
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase.rpc('premium_brand_user_ids', { p_user_ids: ids })
  // A missing badge is cosmetic; never let it take the listings feed down.
  if (error) return new Set()
  return new Set((data ?? []) as string[])
}
