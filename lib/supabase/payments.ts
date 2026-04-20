import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']
type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert']
type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update']
type PaymentRow = Database['public']['Tables']['payments']['Row']
type PaymentInsert = Database['public']['Tables']['payments']['Insert']
type PaymentUpdate = Database['public']['Tables']['payments']['Update']

export class PaymentsError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'PaymentsError'
  }
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

// Used by webhook handlers where brand_profiles.id is known directly
export async function getSubscription(
  supabase: SupabaseClient<Database>,
  brandId: string
): Promise<SubscriptionRow | null> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('subscriptions')
    .select('*')
    .eq('brand_id', brandId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new PaymentsError('SUBSCRIPTION_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as SubscriptionRow
}

// Used by routes — joins brand_profiles to find subscription by auth user id
export async function getSubscriptionForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SubscriptionRow | null> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('brand_profiles')
    .select('id, subscriptions(*)')
    .eq('user_id', userId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new PaymentsError('SUBSCRIPTION_FETCH_FAILED', (error as { message: string }).message)
  }

  const row = data as { id: string; subscriptions: SubscriptionRow[] | null }
  return (row.subscriptions ?? [])[0] ?? null
}

export async function upsertSubscription(
  supabase: SupabaseClient<Database>,
  data: SubscriptionInsert
): Promise<SubscriptionRow> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: row, error } = await (supabase as SupabaseClient)
    .from('subscriptions')
    .upsert(data, { onConflict: 'brand_id' })
    .select()
    .single()

  if (error) {
    throw new PaymentsError('SUBSCRIPTION_UPSERT_FAILED', (error as { message: string }).message)
  }

  return row as SubscriptionRow
}

export async function updateSubscription(
  supabase: SupabaseClient<Database>,
  stripeSubscriptionId: string,
  data: SubscriptionUpdate
): Promise<SubscriptionRow> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: row, error } = await (supabase as SupabaseClient)
    .from('subscriptions')
    .update(data)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new PaymentsError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found')
    }
    throw new PaymentsError('SUBSCRIPTION_UPDATE_FAILED', (error as { message: string }).message)
  }

  return row as SubscriptionRow
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function getPayment(
  supabase: SupabaseClient<Database>,
  contractId: string
): Promise<PaymentRow | null> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('payments')
    .select('*')
    .eq('contract_id', contractId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new PaymentsError('PAYMENT_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as PaymentRow
}

export async function getPaymentHistory(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PaymentRow[]> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('payments')
    .select('*')
    .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) {
    throw new PaymentsError('PAYMENT_HISTORY_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as PaymentRow[]
}

export async function createPaymentRecord(
  supabase: SupabaseClient<Database>,
  data: PaymentInsert
): Promise<PaymentRow> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: row, error } = await (supabase as SupabaseClient)
    .from('payments')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new PaymentsError('PAYMENT_INSERT_FAILED', (error as { message: string }).message)
  }

  return row as PaymentRow
}

export type ContractForPayment = {
  id: string
  brand_id: string
  athlete_or_team_id: string
  pay_amount: number
  pay_currency: string
}

export async function getContractForPayment(
  supabase: SupabaseClient<Database>,
  contractId: string
): Promise<ContractForPayment> {
  // Joins contracts → proposals to retrieve payment amount without exposing deals lib to payments routes
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('contracts')
    .select('id, brand_id, athlete_or_team_id, proposals(pay_amount, pay_currency)')
    .eq('id', contractId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new PaymentsError('CONTRACT_NOT_FOUND', 'Contract not found or not accessible')
    }
    throw new PaymentsError('CONTRACT_FETCH_FAILED', (error as { message: string }).message)
  }

  const row = (data as unknown) as {
    id: string
    brand_id: string
    athlete_or_team_id: string
    proposals: { pay_amount: number; pay_currency: string } | Array<{ pay_amount: number; pay_currency: string }> | null
  }
  // PostgREST returns joined rows as an array for 1:many; normalise to single object
  const proposalData = Array.isArray(row.proposals) ? (row.proposals[0] ?? null) : row.proposals

  if (!proposalData) {
    throw new PaymentsError('CONTRACT_FETCH_FAILED', 'Contract has no linked proposal')
  }

  return {
    id: row.id,
    brand_id: row.brand_id,
    athlete_or_team_id: row.athlete_or_team_id,
    pay_amount: proposalData.pay_amount,
    pay_currency: proposalData.pay_currency ?? 'GBP',
  }
}

export async function updatePaymentRecord(
  supabase: SupabaseClient<Database>,
  stripePaymentIntentId: string,
  data: PaymentUpdate
): Promise<PaymentRow> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: row, error } = await (supabase as SupabaseClient)
    .from('payments')
    .update(data)
    .eq('stripe_payment_intent_id', stripePaymentIntentId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new PaymentsError('PAYMENT_NOT_FOUND', 'Payment not found for this payment intent')
    }
    throw new PaymentsError('PAYMENT_UPDATE_FAILED', (error as { message: string }).message)
  }

  return row as PaymentRow
}
