import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  RATE_LIMITS,
  consume,
  tooManyRequests,
  ipKey,
  clientIpFrom,
} from '@/lib/rate-limit'
import { acceptGuardianConsent, GuardianConsentError } from '@/lib/supabase/guardian'

/**
 * A guardian confirms consent by POSTing the token from their emailed link
 * (2.3). Unauthenticated by design: the guardian is not a Podium user, and the
 * token is the capability. Keyed by IP so a leaked-but-unknown token space
 * cannot be brute-forced. State change is a POST behind a confirm click, never a
 * GET, so following the link cannot itself consent.
 */
export async function POST(request: NextRequest) {
  const limited = await consume(
    ipKey('guardian_consent_accept', clientIpFrom(request.headers)),
    RATE_LIMITS.guardianConsentByIp
  )
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  let body: { token?: string }
  try {
    body = (await request.json()) as { token?: string }
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    )
  }

  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json(
      { error: { code: 'MISSING_TOKEN', message: 'A consent token is required' } },
      { status: 400 }
    )
  }

  const STATUS_BY_CODE: Record<string, number> = {
    TOKEN_INVALID: 404,
    TOKEN_EXPIRED: 410,
    ATHLETE_NOT_FOUND: 404,
  }

  const admin = createAdminClient()

  try {
    const result = await acceptGuardianConsent(admin, token)
    return NextResponse.json({ status: 'accepted', athleteName: result.athleteName })
  } catch (err) {
    if (err instanceof GuardianConsentError) {
      const status = STATUS_BY_CODE[err.code] ?? 500
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
    }
    throw err
  }
}
