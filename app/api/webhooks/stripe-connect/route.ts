import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { accountStatus } from '@/lib/stripe/connect'
import { updateConnectStatus } from '@/lib/supabase/connect'
import { withRequestContext } from '@/lib/observability'

/**
 * Stripe Connect webhook: keeps connect_accounts readiness in sync as accounts
 * finish onboarding. Uses its own signing secret (STRIPE_CONNECT_WEBHOOK_SECRET)
 * because Connect events come from a separate webhook endpoint.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const obs = withRequestContext({ route: '/api/webhooks/stripe-connect' })
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET

  if (!secret) {
    obs.captureMessage('STRIPE_CONNECT_WEBHOOK_SECRET is not configured; Connect status will not sync', 'error')
    return NextResponse.json({ error: { code: 'NOT_CONFIGURED', message: 'Connect webhook not configured' } }, { status: 503 })
  }
  if (!signature) {
    return NextResponse.json({ error: { code: 'MISSING_SIGNATURE', message: 'stripe-signature required' } }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event
  try {
    event = constructWebhookEvent(body, signature, secret)
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' } }, { status: 400 })
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    try {
      await updateConnectStatus(createAdminClient(), account.id, accountStatus(account))
    } catch (err) {
      obs.captureException(err, { stage: 'updateConnectStatus', account: account.id })
      return NextResponse.json({ error: { code: 'SYNC_FAILED', message: 'Could not sync account' } }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
