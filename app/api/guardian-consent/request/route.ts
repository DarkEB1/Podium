import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import { requestGuardianConsent, GuardianConsentError } from '@/lib/supabase/guardian'
import { sendGuardianConsentRequestEmail } from '@/lib/email/guardian'
import { absoluteUrl } from '@/lib/email/notify'

/**
 * An under-18 athlete asks us to email their guardian a consent link (2.3).
 * The athlete is the authenticated caller; consent is always requested for
 * themselves, so no target id is accepted from the body.
 */
export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const limited = await consume(userKey('guardian_consent_request', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  const STATUS_BY_CODE: Record<string, number> = {
    NOT_UNDER_18: 400,
    NO_GUARDIAN_EMAIL: 400,
    ALREADY_CONSENTED: 409,
    ATHLETE_NOT_FOUND: 404,
  }

  const admin = createAdminClient()

  try {
    const consent = await requestGuardianConsent(admin, user.id)

    // The token lives only in the emailed link. It is never returned to the
    // athlete's browser, so an athlete cannot self-consent by reading the response.
    await sendGuardianConsentRequestEmail({
      to: consent.guardianEmail,
      guardianName: consent.guardianName,
      athleteName: consent.athleteName,
      consentUrl: absoluteUrl(`/guardian/consent/${consent.rawToken}`),
    })

    return NextResponse.json({ status: 'sent' })
  } catch (err) {
    if (err instanceof GuardianConsentError) {
      const status = STATUS_BY_CODE[err.code] ?? 500
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
    }
    throw err
  }
}
