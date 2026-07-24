import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from './typed-client'

/**
 * Data access for the transactional email layer (email_deliveries +
 * email_suppressions, migration 20260724000000). All calls run with the
 * service-role admin client — these tables have no client write policies.
 *
 * Kept here rather than in lib/email so the architecture rule (no Supabase
 * outside lib/supabase/) and its lint gate hold for the email subsystem too.
 */

export class EmailStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'EmailStoreError'
  }
}

/** Normalise an address the way the suppression key is stored. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'suppressed'
  | 'skipped'

export interface ClaimedDelivery {
  id: string
  /** False when an existing row already held this idempotency key. */
  claimed: boolean
}

/**
 * Insert a `queued` delivery row, claiming the idempotency key. If the key
 * already exists (a retry of the same logical send), returns the existing row
 * id with `claimed: false` so the caller sends nothing. When no key is given,
 * always inserts a fresh row (`claimed: true`).
 *
 * The unique partial index on idempotency_key is what makes the claim atomic —
 * two concurrent callers cannot both insert the same key.
 */
export async function claimDelivery(
  admin: SupabaseClient<Database>,
  row: {
    userId: string | null
    toEmail: string
    eventType: string
    subject: string
    idempotencyKey?: string
  }
): Promise<ClaimedDelivery> {
  const insert = {
    user_id: row.userId,
    to_email: row.toEmail,
    event_type: row.eventType,
    subject: row.subject,
    status: 'queued' as const,
    idempotency_key: row.idempotencyKey ?? null,
  }

  const { data, error } = await db(admin)
    .from('email_deliveries')
    .insert(insert)
    .select('id')
    .single()

  if (!error) {
    return { id: (data as { id: string }).id, claimed: true }
  }

  // 23505 = unique violation on idempotency_key: someone already claimed it.
  if ((error as { code?: string }).code === '23505' && row.idempotencyKey) {
    const { data: existing, error: fetchError } = await db(admin)
      .from('email_deliveries')
      .select('id')
      .eq('idempotency_key', row.idempotencyKey)
      .single()
    if (fetchError) {
      throw new EmailStoreError('DELIVERY_CLAIM_FAILED', (fetchError as { message: string }).message)
    }
    return { id: (existing as { id: string }).id, claimed: false }
  }

  throw new EmailStoreError('DELIVERY_INSERT_FAILED', (error as { message: string }).message)
}

/** Update a delivery row's outcome. */
export async function markDelivery(
  admin: SupabaseClient<Database>,
  id: string,
  patch: { status: DeliveryStatus; providerId?: string | null; attempts?: number; error?: string | null }
): Promise<void> {
  const update: Record<string, unknown> = { status: patch.status }
  if (patch.providerId !== undefined) update.provider_id = patch.providerId
  if (patch.attempts !== undefined) update.attempts = patch.attempts
  if (patch.error !== undefined) update.error = patch.error

  const { error } = await db(admin).from('email_deliveries').update(update).eq('id', id)
  if (error) {
    throw new EmailStoreError('DELIVERY_UPDATE_FAILED', (error as { message: string }).message)
  }
}

/** True when the address is on the suppression list and must not be emailed. */
export async function isSuppressed(
  admin: SupabaseClient<Database>,
  email: string
): Promise<boolean> {
  const { data, error } = await db(admin)
    .from('email_suppressions')
    .select('email')
    .eq('email', normaliseEmail(email))
    .maybeSingle()

  if (error) {
    throw new EmailStoreError('SUPPRESSION_LOOKUP_FAILED', (error as { message: string }).message)
  }
  return data !== null
}

/** Add an address to the suppression list (idempotent). */
export async function addSuppression(
  admin: SupabaseClient<Database>,
  row: {
    email: string
    reason: 'hard_bounce' | 'complaint' | 'unsubscribe' | 'manual'
    userId?: string | null
    detail?: string | null
  }
): Promise<void> {
  const { error } = await db(admin)
    .from('email_suppressions')
    .upsert(
      {
        email: normaliseEmail(row.email),
        reason: row.reason,
        user_id: row.userId ?? null,
        detail: row.detail ?? null,
      },
      { onConflict: 'email', ignoreDuplicates: true }
    )

  if (error) {
    throw new EmailStoreError('SUPPRESSION_INSERT_FAILED', (error as { message: string }).message)
  }
}

/** Resolve a user's email address for delivery. */
export async function getUserEmail(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data, error } = await db(admin)
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new EmailStoreError('USER_EMAIL_LOOKUP_FAILED', (error as { message: string }).message)
  }
  return (data as { email?: string } | null)?.email ?? null
}
