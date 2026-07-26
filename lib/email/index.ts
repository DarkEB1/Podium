import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getNotificationMatrix, getSettings } from '@/lib/supabase/settings'
import {
  claimDelivery,
  markDelivery,
  isSuppressed,
  getUserEmail,
  type DeliveryStatus,
} from '@/lib/supabase/email'
import { captureException } from '@/lib/observability'
import { EMAIL_EVENTS, categoryOf, type EmailEvent, type TemplateData } from './types'
import { renderEmail } from './templates'
import { sendViaProvider } from './provider'
import { signUnsubscribeToken } from './unsubscribe'

/**
 * The public entry point for transactional email (lib/email).
 *
 * `sendTransactionalEmail` is the ONE function callers use. Given an event, a
 * recipient user, and the template data, it:
 *   1. resolves the recipient's address,
 *   2. gates on the user's notification preferences (per-event, plus the
 *      marketing opt-in for marketing events),
 *   3. checks the suppression list (bounces/complaints/unsubscribes),
 *   4. claims an idempotency key so a webhook retry cannot double-send,
 *   5. renders (escaped) HTML + text with the mandatory CL-4 footer,
 *   6. delivers with bounded exponential backoff (FA-10),
 *   7. records the outcome in email_deliveries.
 *
 * It NEVER throws: email is a side effect of a primary action (accepting a
 * proposal, taking a payment), and a mail hiccup must not roll that action
 * back. Failures are recorded and reported to observability. The return value
 * says what happened for callers that want to assert on it.
 */

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [0, 400, 1200] as const

export interface SendEmailParams<E extends EmailEvent> {
  event: E
  /** Recipient user id — used for preferences, address lookup and the delivery row. */
  userId: string
  data: TemplateData[E]
  /**
   * Stable key that makes the send idempotent (e.g.
   * `contract_signed:<contractId>`). A second call with the same key is a
   * no-op. Strongly recommended for anything triggered by a webhook.
   */
  idempotencyKey?: string
  /** Override the resolved address (rare — e.g. sending to a pending invite). */
  toOverride?: string
}

export type SendEmailResult =
  | { status: 'sent'; deliveryId: string; providerId: string }
  | { status: 'skipped'; reason: 'preferences' | 'suppressed' | 'no_address' | 'duplicate' | 'no_provider' }
  | { status: 'failed'; deliveryId: string; error: string }
  | { status: 'error'; error: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Whether this user wants this event by email. Per-event matrix entry wins;
 * otherwise the event's default. Marketing events additionally require the
 * explicit marketing opt-in — a per-event "on" never overrides a global "no
 * marketing".
 */
async function emailAllowed(
  admin: SupabaseClient<Database>,
  userId: string,
  event: EmailEvent
): Promise<boolean> {
  const def = EMAIL_EVENTS[event]

  const settings = await getSettings(admin, userId)
  if (categoryOf(event) === 'marketing' && !settings.marketing_opt_in) return false

  const matrix = await getNotificationMatrix(admin, userId)
  const entry = matrix[event]
  return entry?.email ?? def.defaultEmail
}

export async function sendTransactionalEmail<E extends EmailEvent>(
  admin: SupabaseClient<Database>,
  params: SendEmailParams<E>
): Promise<SendEmailResult> {
  const { event, userId, data, idempotencyKey } = params
  const def = EMAIL_EVENTS[event]

  try {
    // 1. Address
    const address = params.toOverride ?? (await getUserEmail(admin, userId))
    if (!address) return { status: 'skipped', reason: 'no_address' }

    // 2. Preferences
    if (!(await emailAllowed(admin, userId, event))) {
      return { status: 'skipped', reason: 'preferences' }
    }

    // 3. Suppression
    if (await isSuppressed(admin, address)) {
      return { status: 'skipped', reason: 'suppressed' }
    }

    // 5. Render (footer URLs first so the subject/body carry them).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
    const preferencesUrl = `${appUrl}/settings/notifications`
    // Transactional service messages are exempt from a one-click unsubscribe
    // (you cannot unsubscribe from a receipt you may need); they carry a
    // preferences link only. Marketing messages get the one-click unsubscribe.
    let unsubscribeUrl: string | undefined
    if (categoryOf(event) === 'marketing') {
      try {
        unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${signUnsubscribeToken(userId, 'marketing')}`
      } catch {
        // Secret unset: ship a preferences link rather than no footer at all.
        unsubscribeUrl = undefined
      }
    }

    const rendered = renderEmail(event, data, { preferencesUrl, ...(unsubscribeUrl ? { unsubscribeUrl } : {}) })

    // 4. Claim idempotency (also creates the audit row).
    const claim = await claimDelivery(admin, {
      userId,
      toEmail: address,
      eventType: event,
      subject: rendered.subject,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    })
    if (!claim.claimed) return { status: 'skipped', reason: 'duplicate' }

    // 6. Deliver with backoff.
    let attempts = 0
    let lastError = 'unknown'
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (BACKOFF_MS[i]) await sleep(BACKOFF_MS[i]!)
      attempts = i + 1

      const result = await sendViaProvider({
        to: address,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(unsubscribeUrl ? { listUnsubscribeUrl: unsubscribeUrl } : {}),
      })

      if (result.ok) {
        await markDelivery(admin, claim.id, {
          status: 'sent',
          providerId: result.providerId,
          attempts,
        })
        return { status: 'sent', deliveryId: claim.id, providerId: result.providerId }
      }

      if ('skipped' in result) {
        // No provider configured — record and stop (retrying will not help).
        await markDelivery(admin, claim.id, { status: 'skipped', attempts, error: result.error })
        return { status: 'skipped', reason: 'no_provider' }
      }

      lastError = result.error
      if (!result.retriable) break
    }

    await markDelivery(admin, claim.id, { status: 'failed' as DeliveryStatus, attempts, error: lastError })
    captureException(new Error(`email send failed: ${lastError}`), {
      event,
      deliveryId: claim.id,
      // never log the recipient address
    })
    return { status: 'failed', deliveryId: claim.id, error: lastError }
  } catch (err) {
    // A failure in the email path must never break the caller's transaction.
    captureException(err, { event, stage: 'sendTransactionalEmail' })
    return { status: 'error', error: err instanceof Error ? err.message : 'email error' }
  }
}
