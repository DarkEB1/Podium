import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { vapidAuthHeader, encryptPayload, postToEndpoint } from './webpush'

/**
 * Push delivery (spec §7). Mirrors the email stack's shape: a single entry point
 * that NEVER throws and no-ops when unconfigured, so a missing key is a "skipped"
 * not an error. VAPID keys are self-generated; no third-party account is needed.
 */

export interface PushPayload {
  title: string
  body: string
  url?: string
}

type SubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

export type PushSendResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'no_provider' }
  | { status: 'expired' }
  | { status: 'error'; error: string }

/** Deliver one notification to one subscription. Never throws. */
export async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<PushSendResult> {
  if (!pushConfigured()) return { status: 'skipped', reason: 'no_provider' }
  try {
    const body = await encryptPayload(new TextEncoder().encode(JSON.stringify(payload)), {
      p256dh: sub.p256dh,
      auth: sub.auth,
    })
    const auth = await vapidAuthHeader(
      sub.endpoint,
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
    const result = await postToEndpoint(sub.endpoint, body, auth)
    if (result.ok) return { status: 'sent' }
    if ('expired' in result) return { status: 'expired' }
    return { status: 'error', error: result.error }
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'push error' }
  }
}

/** Send to every subscription a user has, pruning ones the push service has dropped. */
export async function sendPushToUser(
  admin: SupabaseClient<Database>,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; skipped: boolean }> {
  if (!pushConfigured()) return { sent: 0, skipped: true }

  const { data } = await (admin as SupabaseClient)
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  const subs = (data as SubscriptionRow[] | null) ?? []

  let sent = 0
  for (const sub of subs) {
    const result = await sendWebPush(sub, payload)
    if (result.status === 'sent') sent++
    if (result.status === 'expired') {
      await (admin as SupabaseClient).from('push_subscriptions').delete().eq('id', sub.id)
    }
  }
  return { sent, skipped: false }
}

export async function storePushSubscription(
  supabase: SupabaseClient<Database>,
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
  userAgent?: string | null
): Promise<void> {
  await (supabase as SupabaseClient).from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: userAgent ?? null,
    },
    { onConflict: 'endpoint' }
  )
}

export async function deletePushSubscription(
  supabase: SupabaseClient<Database>,
  userId: string,
  endpoint: string
): Promise<void> {
  await (supabase as SupabaseClient)
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
}
