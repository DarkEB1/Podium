import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']
type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert']
type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update']
type PaymentRow = Database['public']['Tables']['payments']['Row']
type PaymentInsert = Database['public']['Tables']['payments']['Insert']
type PaymentUpdate = Database['public']['Tables']['payments']['Update']
type PaymentMethodRow = Database['public']['Tables']['payment_methods']['Row']

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

// Resolves brand_profiles.id (what subscriptions.brand_id references) from an
// auth user id. Returns null when the user has no brand profile.
export async function getBrandProfileIdForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('brand_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new PaymentsError('BRAND_PROFILE_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data as { id: string }).id
}

// Webhook fallback: recover the brand from an existing subscription row that
// already carries the Stripe customer id.
//
// Deliberately tolerant of zero OR many matches. `stripe_customer_id` carries no
// uniqueness guarantee, and `.single()` turns "more than one row" into a generic
// error that is indistinguishable from a real database failure — which used to
// classify as transient and produce an endless 500 retry loop on every webhook.
// Ordering by created_at makes the choice deterministic (oldest link wins: it is
// the row that first bound this Stripe customer to a brand).
//
// REVIEWED after the reconciliation job landed (ST-3/ST-4/ST-6): oldest-wins is
// still correct here, and the job does not change that.
//   * This resolver only ever answers "which BRAND does this Stripe customer
//     belong to?" — it is a fallback for a subscription whose metadata is
//     missing. Every row sharing a stripe_customer_id necessarily shares the
//     brand, so which row wins does not affect the answer. Newest-wins would
//     churn the choice for no gain.
//   * Determinism is the property that matters: an unstable answer makes the
//     webhook and the reconciliation job resolve the same customer differently
//     and fight over the row.
//   * The job never uses this path to decide a subscription's STATE — state
//     always comes from Stripe, keyed on stripe_subscription_id, which is exact.
export async function getSubscriptionByStripeCustomerId(
  supabase: SupabaseClient<Database>,
  stripeCustomerId: string
): Promise<SubscriptionRow | null> {
  // A blank id can only match placeholder rows; never look it up.
  if (!stripeCustomerId.trim()) return null

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('subscriptions')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    // PGRST116 = no rows — treat as "not linked yet"
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new PaymentsError('SUBSCRIPTION_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data as SubscriptionRow | null) ?? null
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
// Reconciliation support (ST-3 / ST-4 / ST-6)
// ---------------------------------------------------------------------------

/** Statuses that still grant a brand access, i.e. worth re-checking in Stripe. */
export const ACTIVE_SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'paused',
] as const

/** Exact lookup by Stripe subscription id. Returns null when unlinked. */
export async function getSubscriptionByStripeSubscriptionId(
  supabase: SupabaseClient<Database>,
  stripeSubscriptionId: string
): Promise<SubscriptionRow | null> {
  if (!stripeSubscriptionId.trim()) return null

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new PaymentsError('SUBSCRIPTION_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data as SubscriptionRow | null) ?? null
}

/**
 * Local rows that still grant access but whose billing period already ended.
 *
 * These are the candidates for the local-first half of reconciliation: if a
 * renewal had happened, `current_period_end` would have moved forward, so a row
 * still sitting behind `now()` means the local copy stopped being updated —
 * either the subscription was cancelled while the webhook was down, or the
 * renewal webhook was missed. Bounded and ordered so repeated invocations make
 * progress from the most stale row outwards.
 */
export async function listStaleSubscriptions(
  supabase: SupabaseClient<Database>,
  options: { before: string; limit: number }
): Promise<SubscriptionRow[]> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('subscriptions')
    .select('*')
    .in('status', [...ACTIVE_SUBSCRIPTION_STATUSES])
    .lt('current_period_end', options.before)
    .order('current_period_end', { ascending: true })
    .limit(options.limit)

  if (error) {
    throw new PaymentsError('SUBSCRIPTION_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as SubscriptionRow[]
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

// The intents route inserts the payment row synchronously; the
// payment_intent.created webhook must not insert a duplicate.
export async function getPaymentByIntentId(
  supabase: SupabaseClient<Database>,
  stripePaymentIntentId: string
): Promise<PaymentRow | null> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('payments')
    .select('*')
    .eq('stripe_payment_intent_id', stripePaymentIntentId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new PaymentsError('PAYMENT_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as PaymentRow
}

/**
 * ST-7 — the payment for `contractId` that is still in play, if any.
 *
 * `failed` and `refunded` are terminal, so a contract in either of those states
 * may legitimately be paid again; `pending`, `processing` and `succeeded` mean
 * a second intent would double-charge or strand the first.
 *
 * Ordered and limited rather than `.single()` on purpose: `.single()` errors on
 * multiple rows, which is exactly the corruption this guard exists to stop, so
 * it must not itself break on already-duplicated data.
 */
export async function getLivePaymentForContract(
  supabase: SupabaseClient<Database>,
  contractId: string
): Promise<PaymentRow | null> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('payments')
    .select('*')
    .eq('contract_id', contractId)
    .in('status', ['pending', 'processing', 'succeeded'])
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new PaymentsError('PAYMENT_FETCH_FAILED', (error as { message: string }).message)
  }

  const rows = (data ?? []) as PaymentRow[]
  return rows[0] ?? null
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

// ---------------------------------------------------------------------------
// Billing history & seats (brand subscriptions)
// ---------------------------------------------------------------------------

export type BillingHistoryItem = {
  id: string
  amount: number
  currency: string
  status: PaymentRow['status']
  created_at: string
  receipt_url: string | null
}

// Brand billing history is sourced from the `payments` table (Stripe-synced),
// surfacing the amount, status, and the receipt/invoice PDF url per charge.
export async function getBillingHistory(
  supabase: SupabaseClient<Database>,
  brandId: string
): Promise<BillingHistoryItem[]> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('payments')
    .select('id, amount, currency, status, created_at, receipt_url')
    .eq('payer_id', brandId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new PaymentsError('BILLING_HISTORY_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as BillingHistoryItem[]
}

export type SeatSummary = {
  seats_total: number
  seats_used: number
  members: PaymentMethodRow[]
}

// Lists the brand's subscription seat allocation. Seats are tracked as counts on
// the subscription row (seats_total / seats_used); there is no per-seat member
// table in v1, so members is returned empty until that schema lands.
export async function listSeats(
  supabase: SupabaseClient<Database>,
  brandId: string
): Promise<SeatSummary> {
  const subscription = await getSubscription(supabase, brandId)

  if (!subscription) {
    throw new PaymentsError('SUBSCRIPTION_NOT_FOUND', 'No subscription for this brand')
  }

  return {
    seats_total: subscription.seats_total,
    seats_used: subscription.seats_used,
    members: [],
  }
}

// Releases one occupied seat by decrementing seats_used on the subscription.
export async function removeSeat(
  supabase: SupabaseClient<Database>,
  brandId: string
): Promise<SubscriptionRow> {
  const subscription = await getSubscription(supabase, brandId)

  if (!subscription) {
    throw new PaymentsError('SUBSCRIPTION_NOT_FOUND', 'No subscription for this brand')
  }

  const nextUsed = Math.max(0, subscription.seats_used - 1)

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('subscriptions')
    .update({ seats_used: nextUsed })
    .eq('brand_id', brandId)
    .select()
    .single()

  if (error) {
    throw new PaymentsError('SEAT_REMOVE_FAILED', (error as { message: string }).message)
  }

  return data as SubscriptionRow
}

// ---------------------------------------------------------------------------
// Stripe webhook event log (idempotency + poison-event guard)
//
// Table added in supabase/migrations/20260720002000_stripe_webhook_events.sql.
// It is service-role only, so it is intentionally absent from the RLS-facing
// generated `Database` type; the row shape is declared here instead.
// ---------------------------------------------------------------------------

export type WebhookEventStatus = 'received' | 'processed' | 'failed' | 'unprocessable'

export type StripeWebhookEventRow = {
  id: string
  type: string
  received_at: string
  processed_at: string | null
  status: WebhookEventStatus
  error: string | null
  payload: unknown
}

export async function getWebhookEvent(
  supabase: SupabaseClient<Database>,
  eventId: string
): Promise<StripeWebhookEventRow | null> {
  // as SupabaseClient: strips the Database generic; table is service-role only
  // and therefore not present in the generated Database type
  const { data, error } = await (supabase as SupabaseClient)
    .from('stripe_webhook_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new PaymentsError('WEBHOOK_EVENT_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as StripeWebhookEventRow
}

export type WebhookEventClaim = {
  /** True only for the caller that won the right to run the handlers. */
  claimed: boolean
  /** How many times this event has been claimed, including this claim. */
  attempts: number
  /** Current row status; null only if the row vanished between statements. */
  status: WebhookEventStatus | null
}

/**
 * Atomically claims one delivery of a Stripe event.
 *
 * Replaces the previous read-then-upsert pair, which was not atomic: two
 * concurrent deliveries of the same event id could both see "not processed yet"
 * and both run the handlers. `claim_stripe_webhook_event`
 * (20260720006000_stripe_webhook_claim_and_customer_guard.sql) does the insert,
 * the terminal-status check and the attempt increment in one locked statement,
 * so exactly one caller gets `claimed: true`.
 *
 * `claimed: false` means either the event already reached a terminal status
 * (processed / unprocessable) or another worker currently holds it — in both
 * cases this delivery must not run the handlers.
 */
export async function claimWebhookEvent(
  supabase: SupabaseClient<Database>,
  event: { id: string; type: string; payload: unknown }
): Promise<WebhookEventClaim> {
  // as SupabaseClient: strips the Database generic; the RPC and the underlying
  // service-role-only table are absent from the generated Database types.
  const { data, error } = await (supabase as SupabaseClient).rpc('claim_stripe_webhook_event', {
    p_id: event.id,
    p_type: event.type,
    p_payload: event.payload,
  })

  if (error) {
    throw new PaymentsError('WEBHOOK_EVENT_CLAIM_FAILED', (error as { message: string }).message)
  }

  // A `returns table` function comes back as a one-row array over PostgREST.
  const rows = Array.isArray(data) ? data : [data]
  const row = (rows[0] ?? null) as {
    did_claim?: boolean
    attempt_count?: number
    event_status?: WebhookEventStatus
  } | null

  if (!row) {
    throw new PaymentsError('WEBHOOK_EVENT_CLAIM_FAILED', 'claim returned no row')
  }

  return {
    claimed: row.did_claim === true,
    attempts: row.attempt_count ?? 0,
    status: row.event_status ?? null,
  }
}

export async function markWebhookEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
  status: WebhookEventStatus,
  errorMessage?: string | null
): Promise<void> {
  // as SupabaseClient: strips the Database generic; table is service-role only
  const { error } = await (supabase as SupabaseClient)
    .from('stripe_webhook_events')
    .update({
      status,
      error: errorMessage ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (error) {
    throw new PaymentsError('WEBHOOK_EVENT_UPDATE_FAILED', (error as { message: string }).message)
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
