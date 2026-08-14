import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { getBrandAnalytics } from '@/lib/supabase/brand-analytics'
import { ENTITLEMENTS, isTier } from '@/lib/entitlements'

/**
 * Escapes one CSV field. Only quotes when the value contains a comma,
 * double quote, or newline (RFC 4180); embedded quotes are doubled.
 */
function csvField(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// A function, not a hoisted constant: NextResponse wraps a Response whose body
// stream can only be consumed once, so reusing a single instance across
// requests would make the second caller's res.json()/text() throw.
function forbidden() {
  return NextResponse.json(
    { error: { code: 'FORBIDDEN', message: 'Analytics export is an Enterprise feature' } },
    { status: 403 }
  )
}

/**
 * GET /api/brand/analytics/export
 *
 * Enterprise-gated (tier 3, active/trialing) CSV download of the same
 * analytics `getBrandAnalytics` powers on the dashboard (Task 8/9). Every
 * other caller (no session, non-brand role, no subscription, tier 1/2, or a
 * lapsed Enterprise subscription) gets a uniform 403 — the response never
 * distinguishes "not a brand" from "not Enterprise" so it can't be used to
 * fingerprint account state.
 */
export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user || user.role !== 'brand') {
    return forbidden()
  }

  const subscription = await getSubscriptionForUser(supabase, user.id)
  const tier = subscription && isTier(subscription.tier) ? subscription.tier : null
  const active = subscription?.status === 'active' || subscription?.status === 'trialing'
  const unlocked = subscription !== null && tier !== null && ENTITLEMENTS[tier].analytics && active
  // `!subscription` is redundant to `!unlocked` (unlocked can only be true when
  // subscription is non-null), but TS can't narrow subscription's nullability
  // through the `unlocked` boolean, so it stays for the compiler.
  if (!unlocked || !subscription) {
    return forbidden()
  }

  // subscriptions.brand_id already IS brand_profiles.id (see getBrandProfileIdForUser
  // in lib/supabase/payments.ts) — no need for a second lookup.
  const analytics = await getBrandAnalytics(
    supabase,
    user.id,
    subscription.brand_id,
    subscription.current_period_start,
    subscription.current_period_end
  )

  const lines: string[] = []
  lines.push('metric,value')
  lines.push(`requestsSent,${analytics.funnel.requestsSent}`)
  lines.push(`accepted,${analytics.funnel.accepted}`)
  lines.push(`declined,${analytics.funnel.declined}`)
  lines.push(`responded,${analytics.funnel.responded}`)
  lines.push(`messaged,${analytics.funnel.messaged}`)
  lines.push(`acceptanceRate,${analytics.acceptanceRate.toFixed(4)}`)
  lines.push(`responseRate,${analytics.responseRate.toFixed(4)}`)
  lines.push(`connectedAthletes,${analytics.connectedAthletes}`)
  lines.push(`reachAudience,${analytics.reachAudience}`)
  lines.push(`activeListings,${analytics.listings.active}`)
  lines.push(`totalListings,${analytics.listings.total}`)
  lines.push('')
  lines.push('date,requestsSent,accepted')
  for (const point of analytics.timeSeries) {
    lines.push([csvField(point.date), point.requestsSent, point.accepted].join(','))
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="podium-analytics.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
