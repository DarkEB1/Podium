import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAuthorizedCronRequest, cronUnauthorized } from '@/lib/cron/auth'
import { withRequestContext } from '@/lib/observability'
import {
  listSubscriptionsPage,
  retrieveSubscriptionSnapshot,
  STRIPE_LIST_MAX_PAGE_SIZE,
  type StripeSubscriptionSnapshot,
} from '@/lib/stripe'
import {
  getSubscriptionByStripeSubscriptionId,
  getSubscriptionByStripeCustomerId,
  listStaleSubscriptions,
  upsertSubscription,
  updateSubscription,
  PaymentsError,
} from '@/lib/supabase/payments'
import type { Database } from '@/types/database'

/**
 * ST-3 / ST-4 / ST-6 — subscription reconciliation.
 *
 * The Stripe webhook handles the lifecycle events correctly, but webhooks get
 * missed: the endpoint is down, Stripe drops an event after its retry budget, a
 * signing secret is rotated and deliveries fail signature verification. When one
 * is missed the local `subscriptions` row diverges from Stripe silently and
 * nothing ever notices — a brand keeps access it stopped paying for, or loses
 * access it is still paying for. Phase 3 of the spec requires this job.
 *
 * Stripe is the source of truth in every direction. The job only ever copies
 * Stripe's values onto the local row.
 *
 * Two passes, because the failure modes are not symmetric:
 *
 *   Pass A (Stripe -> local): walk Stripe's subscription list newest-first and
 *     compare each against the local row.
 *       * drift in status / tier / period dates / trial / cancellation -> corrected
 *       * no local row at all -> created (the B-2 failure mode: the brand paid,
 *         checkout completed, and the webhook that would have written the row
 *         never arrived — these are the ones that lost money)
 *
 *   Pass B (local -> Stripe): take local rows that still grant access but whose
 *     billing period already ended, and re-read each one from Stripe by id.
 *       * Stripe 404s -> the subscription is gone; mark the row canceled
 *       * Stripe still has it -> apply the same drift correction as pass A
 *     Absence from pass A's bounded listing is deliberately NOT treated as
 *     deletion; that would revoke access from paying brands the moment the
 *     account outgrew one invocation's page budget.
 *
 * Idempotency: every write is an absolute value read from Stripe, and a row that
 * already agrees with Stripe is skipped entirely. Running the job twice in a row
 * makes zero corrections the second time.
 *
 * Bounded: at most MAX_STRIPE_PAGES * STRIPE_LIST_MAX_PAGE_SIZE subscriptions
 * are listed and at most MAX_STALE_LOCAL_ROWS individual retrievals are made per
 * invocation, so the request cannot run past the platform time limit. Pass B is
 * ordered by staleness, so consecutive runs work through any backlog.
 *
 * Auth is the shared cron guard (lib/cron/auth.ts) — identical contract to the
 * GDPR and maintenance jobs. Schedule lives in vercel.json.
 */

// Service-role writes and live Stripe reads: never prerender, never cache.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AdminClient = ReturnType<typeof createAdminClient>
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

/** Stripe list pages walked per invocation (100 subscriptions each). */
const MAX_STRIPE_PAGES = 5

/** Individual Stripe retrievals for stale local rows per invocation. */
const MAX_STALE_LOCAL_ROWS = 50

/**
 * How far past `current_period_end` a row must be before pass B re-reads it.
 *
 * Renewal is not instantaneous and the renewal webhook lands seconds to minutes
 * after the period boundary. Without this grace window every healthy
 * subscription would be re-fetched from Stripe on the invocation that happens to
 * straddle its renewal.
 */
const STALE_GRACE_MS = 6 * 60 * 60 * 1000

/** One field the job changed, recorded so every correction is auditable. */
interface FieldCorrection {
  field: string
  from: string | null
  to: string | null
}

type CorrectionKind =
  | 'drift_corrected'
  | 'local_row_created'
  | 'marked_canceled_missing_in_stripe'

interface Correction {
  kind: CorrectionKind
  stripeSubscriptionId: string
  brandProfileId: string | null
  fields: FieldCorrection[]
}

/** A subscription the job could not act on, with the reason why. */
interface Skip {
  stripeSubscriptionId: string
  reason: string
}

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------

/**
 * Fields on the local row that Stripe owns.
 *
 * Period dates are `not null` in the schema, so a snapshot that carries null for
 * one (Stripe omits them on some incomplete subscriptions) leaves the existing
 * value alone rather than attempting a null write that would fail the column
 * constraint.
 */
function diffAgainstStripe(
  row: SubscriptionRow,
  snapshot: StripeSubscriptionSnapshot
): { fields: FieldCorrection[]; update: Database['public']['Tables']['subscriptions']['Update'] } {
  const fields: FieldCorrection[] = []
  const update: Database['public']['Tables']['subscriptions']['Update'] = {}

  if (row.status !== snapshot.status) {
    fields.push({ field: 'status', from: row.status, to: snapshot.status })
    update.status = snapshot.status
  }

  if (row.tier !== snapshot.tier) {
    fields.push({ field: 'tier', from: String(row.tier), to: String(snapshot.tier) })
    update.tier = snapshot.tier
  }

  if (snapshot.currentPeriodStart && !sameInstant(row.current_period_start, snapshot.currentPeriodStart)) {
    fields.push({
      field: 'current_period_start',
      from: row.current_period_start,
      to: snapshot.currentPeriodStart,
    })
    update.current_period_start = snapshot.currentPeriodStart
  }

  if (snapshot.currentPeriodEnd && !sameInstant(row.current_period_end, snapshot.currentPeriodEnd)) {
    fields.push({
      field: 'current_period_end',
      from: row.current_period_end,
      to: snapshot.currentPeriodEnd,
    })
    update.current_period_end = snapshot.currentPeriodEnd
  }

  if (!sameInstant(row.trial_ends_at, snapshot.trialEndsAt)) {
    fields.push({ field: 'trial_ends_at', from: row.trial_ends_at, to: snapshot.trialEndsAt })
    update.trial_ends_at = snapshot.trialEndsAt
  }

  if (!sameInstant(row.canceled_at, snapshot.canceledAt)) {
    fields.push({ field: 'canceled_at', from: row.canceled_at, to: snapshot.canceledAt })
    update.canceled_at = snapshot.canceledAt
  }

  return { fields, update }
}

/**
 * Timestamp equality by instant, not by string.
 *
 * Postgres returns `2026-07-20T00:00:00+00:00` where Stripe-derived ISO strings
 * are `2026-07-20T00:00:00.000Z`. Comparing the text would report drift on every
 * single row forever and the job would rewrite the whole table on every run.
 */
function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a === b
  return ta === tb
}

// ---------------------------------------------------------------------------
// Correction primitives
// ---------------------------------------------------------------------------

/** Applies drift for a subscription that exists on both sides. Idempotent. */
async function correctDrift(
  admin: AdminClient,
  row: SubscriptionRow,
  snapshot: StripeSubscriptionSnapshot
): Promise<Correction | null> {
  const { fields, update } = diffAgainstStripe(row, snapshot)
  if (fields.length === 0) return null

  await updateSubscription(admin, snapshot.stripeSubscriptionId, update)

  return {
    kind: 'drift_corrected',
    stripeSubscriptionId: snapshot.stripeSubscriptionId,
    brandProfileId: row.brand_id,
    fields,
  }
}

/**
 * Creates the local row for a Stripe subscription that has none (B-2).
 *
 * `brand_id` is resolved the same way the webhook resolves it: subscription
 * metadata first, then an existing row already linked to the same Stripe
 * customer. If neither works the row is NOT invented — `brand_id` is a
 * `not null` FK to brand_profiles, so a guessed value is a guaranteed constraint
 * violation, and a wrong value would hand one brand another brand's billing.
 */
async function createMissingLocalRow(
  admin: AdminClient,
  snapshot: StripeSubscriptionSnapshot
): Promise<Correction | Skip> {
  if (!snapshot.stripeCustomerId) {
    return {
      stripeSubscriptionId: snapshot.stripeSubscriptionId,
      reason: 'no Stripe customer id on the subscription',
    }
  }

  if (!snapshot.currentPeriodStart || !snapshot.currentPeriodEnd) {
    return {
      stripeSubscriptionId: snapshot.stripeSubscriptionId,
      reason: 'Stripe subscription has no billing period yet',
    }
  }

  let brandProfileId = snapshot.brandProfileId
  if (!brandProfileId) {
    const linked = await getSubscriptionByStripeCustomerId(admin, snapshot.stripeCustomerId)
    brandProfileId = linked?.brand_id ?? null
  }

  if (!brandProfileId) {
    return {
      stripeSubscriptionId: snapshot.stripeSubscriptionId,
      reason: 'cannot resolve brand_profiles.id (no metadata.brandProfileId, no linked customer)',
    }
  }

  await upsertSubscription(admin, {
    brand_id: brandProfileId,
    stripe_subscription_id: snapshot.stripeSubscriptionId,
    stripe_customer_id: snapshot.stripeCustomerId,
    tier: snapshot.tier,
    status: snapshot.status,
    current_period_start: snapshot.currentPeriodStart,
    current_period_end: snapshot.currentPeriodEnd,
    trial_ends_at: snapshot.trialEndsAt,
    canceled_at: snapshot.canceledAt,
  })

  return {
    kind: 'local_row_created',
    stripeSubscriptionId: snapshot.stripeSubscriptionId,
    brandProfileId,
    fields: [
      { field: 'status', from: null, to: snapshot.status },
      { field: 'tier', from: null, to: String(snapshot.tier) },
      { field: 'current_period_end', from: null, to: snapshot.currentPeriodEnd },
    ],
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

async function handle(request: NextRequest) {
  const obs = withRequestContext({
    route: '/api/cron/reconcile-subscriptions',
    job: 'reconcile-subscriptions',
  })

  // Same signal as the other two jobs: with the secret unset this endpoint 401s
  // forever and reconciliation silently never happens, which is indistinguishable
  // from "there was never any drift".
  if (!process.env.CRON_SECRET) {
    obs.captureMessage(
      'CRON_SECRET is not configured — the subscription reconciliation job cannot authenticate and will never run',
      'error'
    )
  }

  if (!isAuthorizedCronRequest(request)) {
    obs.captureMessage('Rejected an unauthorised cron invocation', 'warning')
    return cronUnauthorized()
  }

  const corrections: Correction[] = []
  const skipped: Skip[] = []
  let stripeSubscriptionsExamined = 0
  let localRowsExamined = 0
  let truncated = false

  try {
    const admin = createAdminClient()

    // -- Pass A: Stripe -> local ------------------------------------------
    let cursor: string | undefined
    for (let page = 0; page < MAX_STRIPE_PAGES; page++) {
      // startingAfter is spread rather than passed as `undefined`: the project
      // runs with exactOptionalPropertyTypes, so an explicit undefined is not
      // the same as an absent optional property.
      const { subscriptions, hasMore, nextCursor } = await listSubscriptionsPage({
        limit: STRIPE_LIST_MAX_PAGE_SIZE,
        ...(cursor ? { startingAfter: cursor } : {}),
      })

      for (const snapshot of subscriptions) {
        stripeSubscriptionsExamined++
        const row = await getSubscriptionByStripeSubscriptionId(
          admin,
          snapshot.stripeSubscriptionId
        )

        const result = row
          ? await correctDrift(admin, row, snapshot)
          : await createMissingLocalRow(admin, snapshot)

        if (!result) continue
        if ('kind' in result) corrections.push(result)
        else skipped.push(result)
      }

      if (!hasMore || !nextCursor) {
        cursor = undefined
        break
      }
      cursor = nextCursor
      // Ran out of page budget with pages still to go: report it rather than
      // letting a silently partial run look like a clean one.
      if (page === MAX_STRIPE_PAGES - 1) truncated = true
    }

    // -- Pass B: local -> Stripe -------------------------------------------
    const staleBefore = new Date(Date.now() - STALE_GRACE_MS).toISOString()
    const staleRows = await listStaleSubscriptions(admin, {
      before: staleBefore,
      limit: MAX_STALE_LOCAL_ROWS,
    })

    for (const row of staleRows) {
      localRowsExamined++
      const snapshot = await retrieveSubscriptionSnapshot(row.stripe_subscription_id)

      if (!snapshot) {
        // Stripe has no such subscription. It was cancelled (or the object was
        // removed) while the webhook was down. Mark it canceled — a status
        // transition, never a delete: the row stays for billing history and the
        // transition reverses if the brand resubscribes.
        await updateSubscription(admin, row.stripe_subscription_id, {
          status: 'canceled',
          canceled_at: row.canceled_at ?? new Date().toISOString(),
        })
        corrections.push({
          kind: 'marked_canceled_missing_in_stripe',
          stripeSubscriptionId: row.stripe_subscription_id,
          brandProfileId: row.brand_id,
          fields: [{ field: 'status', from: row.status, to: 'canceled' }],
        })
        continue
      }

      const corrected = await correctDrift(admin, row, snapshot)
      if (corrected) corrections.push(corrected)
    }

    // Every correction is logged individually — a reconciliation job that fixes
    // billing state without saying what it changed is unauditable.
    for (const correction of corrections) {
      obs.captureMessage('Reconciled a subscription against Stripe', 'warning', {
        kind: correction.kind,
        stripe_subscription_id: correction.stripeSubscriptionId,
        brand_id: correction.brandProfileId,
        fields: correction.fields,
      })
    }

    for (const skip of skipped) {
      obs.captureMessage('Could not reconcile a Stripe subscription', 'error', {
        stripe_subscription_id: skip.stripeSubscriptionId,
        reason: skip.reason,
      })
    }

    if (truncated) {
      obs.captureMessage(
        'Reconciliation hit its per-invocation page budget; Stripe has more subscriptions than were examined',
        'warning',
        { max_pages: MAX_STRIPE_PAGES, page_size: STRIPE_LIST_MAX_PAGE_SIZE }
      )
    }

    return NextResponse.json({
      ok: true,
      reconciled_at: new Date().toISOString(),
      stripe_subscriptions_examined: stripeSubscriptionsExamined,
      local_rows_examined: localRowsExamined,
      corrections: corrections.length,
      drift_corrected: corrections.filter((c) => c.kind === 'drift_corrected').length,
      local_rows_created: corrections.filter((c) => c.kind === 'local_row_created').length,
      marked_canceled: corrections.filter((c) => c.kind === 'marked_canceled_missing_in_stripe')
        .length,
      skipped: skipped.length,
      truncated,
    })
  } catch (err) {
    obs.captureException(err, {
      stage: 'reconcile_subscriptions',
      corrections_applied: corrections.length,
    })
    const message =
      err instanceof PaymentsError || err instanceof Error
        ? err.message
        : 'Subscription reconciliation failed'
    return NextResponse.json(
      { error: { code: 'RECONCILIATION_FAILED', message } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

// Vercel Cron issues GET; POST is accepted so an operator holding the secret can
// force a reconciliation immediately after a webhook outage.
export async function POST(request: NextRequest) {
  return handle(request)
}
