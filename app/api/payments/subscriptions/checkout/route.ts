import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser, getBrandProfileIdForUser } from '@/lib/supabase/payments'
import { createCheckoutSession } from '@/lib/stripe'
import { clientEnv } from '@/lib/env'

const VALID_TIERS = new Set([1, 2, 3])

export async function POST(request: NextRequest) {
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
      { error: { code: 'BRAND_ONLY', message: 'Only brand accounts can subscribe' } },
      { status: 403 }
    )
  }

  const body = (await request.json()) as { tier?: unknown }
  const { tier } = body

  if (tier === undefined || tier === null) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'tier is required' } },
      { status: 400 }
    )
  }

  if (typeof tier !== 'number' || !VALID_TIERS.has(tier)) {
    return NextResponse.json(
      { error: { code: 'INVALID_TIER', message: 'tier must be 1, 2, or 3' } },
      { status: 400 }
    )
  }

  // subscriptions.brand_id references brand_profiles.id, so the checkout session
  // must carry brand_profiles.id — not the auth user id (B-2).
  const brandProfileId = await getBrandProfileIdForUser(supabase, user.id)

  if (!brandProfileId) {
    return NextResponse.json(
      { error: { code: 'NO_BRAND_PROFILE', message: 'Complete your brand profile before subscribing' } },
      { status: 404 }
    )
  }

  const appUrl = clientEnv().NEXT_PUBLIC_APP_URL
  const existing = await getSubscriptionForUser(supabase, user.id)

  const { url, sessionId } = await createCheckoutSession({
    brandProfileId,
    userId: user.id,
    // tier as 1 | 2 | 3: VALID_TIERS membership is checked above, which the
    // compiler cannot narrow from a Set lookup
    tier: tier as 1 | 2 | 3,
    ...(existing?.stripe_customer_id ? { customerId: existing.stripe_customer_id } : {}),
    successUrl: `${appUrl}/dashboard?subscription=success`,
    cancelUrl: `${appUrl}/dashboard?subscription=cancelled`,
  })

  return NextResponse.json({ url, sessionId })
}
