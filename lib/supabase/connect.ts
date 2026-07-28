import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ConnectStatus } from '@/lib/stripe/connect'

/** Persistence for Stripe Connect accounts (spec §payments). Service-role writes. */

export type ConnectAccountRow = Database['public']['Tables']['connect_accounts']['Row']

export async function getConnectAccount(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ConnectAccountRow | null> {
  const { data } = await (supabase as SupabaseClient)
    .from('connect_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as ConnectAccountRow | null) ?? null
}

/** Find the owner of a Stripe account id (for the webhook). */
export async function getConnectAccountByStripeId(
  admin: SupabaseClient<Database>,
  stripeAccountId: string
): Promise<ConnectAccountRow | null> {
  const { data } = await (admin as SupabaseClient)
    .from('connect_accounts')
    .select('*')
    .eq('stripe_account_id', stripeAccountId)
    .maybeSingle()
  return (data as ConnectAccountRow | null) ?? null
}

export async function upsertConnectAccount(
  admin: SupabaseClient<Database>,
  userId: string,
  stripeAccountId: string,
  status: ConnectStatus
): Promise<void> {
  await (admin as SupabaseClient).from('connect_accounts').upsert(
    {
      user_id: userId,
      stripe_account_id: stripeAccountId,
      charges_enabled: status.chargesEnabled,
      payouts_enabled: status.payoutsEnabled,
      details_submitted: status.detailsSubmitted,
    },
    { onConflict: 'user_id' }
  )
}

export async function updateConnectStatus(
  admin: SupabaseClient<Database>,
  stripeAccountId: string,
  status: ConnectStatus
): Promise<void> {
  await (admin as SupabaseClient)
    .from('connect_accounts')
    .update({
      charges_enabled: status.chargesEnabled,
      payouts_enabled: status.payoutsEnabled,
      details_submitted: status.detailsSubmitted,
    })
    .eq('stripe_account_id', stripeAccountId)
}
