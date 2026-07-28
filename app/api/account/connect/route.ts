import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getConnectAccount, upsertConnectAccount } from '@/lib/supabase/connect'
import { createConnectAccount, createOnboardingLink, retrieveStatus, ConnectError } from '@/lib/stripe/connect'
import { absoluteUrl } from '@/lib/email/notify'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'

/**
 * Start (or resume) Stripe Connect onboarding for a payee and return a hosted
 * onboarding link. Athletes and teams are the payees; brands and agents pay/earn
 * differently, so they are not offered payouts here.
 */
export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }
  if (user.role !== 'athlete' && user.role !== 'team') {
    return NextResponse.json({ error: { code: 'NOT_A_PAYEE', message: 'Payouts are for athletes and teams' } }, { status: 403 })
  }

  const limited = await consume(userKey('connect_onboard', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  const admin = createAdminClient()

  try {
    let accountId = (await getConnectAccount(supabase, user.id))?.stripe_account_id
    if (!accountId) {
      accountId = await createConnectAccount(user.email)
      const status = await retrieveStatus(accountId)
      await upsertConnectAccount(admin, user.id, accountId, status)
    }

    const url = await createOnboardingLink(
      accountId,
      absoluteUrl('/settings/security?connect=done'),
      absoluteUrl('/settings/security?connect=refresh')
    )
    return NextResponse.json({ url })
  } catch (err) {
    if (err instanceof ConnectError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 502 })
    }
    throw err
  }
}
