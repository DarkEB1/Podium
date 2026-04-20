import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { createCheckoutSession } from '@/lib/stripe'

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

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  const existing = await getSubscriptionForUser(supabase, user.id)

  const { url, sessionId } = await createCheckoutSession({
    brandId: user.id,
    tier: tier as 1 | 2 | 3,
    ...(existing?.stripe_customer_id ? { customerId: existing.stripe_customer_id } : {}),
    successUrl: `${appUrl}/dashboard?subscription=success`,
    cancelUrl: `${appUrl}/dashboard?subscription=cancelled`,
  })

  return NextResponse.json({ url, sessionId })
}
