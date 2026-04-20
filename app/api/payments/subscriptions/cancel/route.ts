import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser, updateSubscription } from '@/lib/supabase/payments'
import { cancelSubscription } from '@/lib/stripe'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (user.role !== 'brand') {
    return NextResponse.json(
      { error: { code: 'BRAND_ONLY', message: 'Only brand accounts can manage subscriptions' } },
      { status: 403 }
    )
  }

  const subscription = await getSubscriptionForUser(supabase, user.id)

  if (!subscription) {
    return NextResponse.json(
      { error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription found' } },
      { status: 404 }
    )
  }

  try {
    await cancelSubscription(subscription.stripe_subscription_id)
  } catch {
    return NextResponse.json(
      { error: { code: 'CANCEL_FAILED', message: 'Failed to cancel subscription with Stripe' } },
      { status: 422 }
    )
  }

  const adminSupabase = createAdminClient()
  await updateSubscription(adminSupabase, subscription.stripe_subscription_id, {
    cancellation_scheduled_at: new Date().toISOString(),
  })

  return NextResponse.json({ message: 'Subscription will cancel at the end of the current billing period' })
}
