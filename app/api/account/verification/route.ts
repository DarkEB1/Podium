import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { requestVerification, VerificationError } from '@/lib/supabase/verification'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'

/** Request a verification badge review. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  const limited = await consume(userKey('verification_request', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  let note: string | undefined
  try {
    const body = (await request.json().catch(() => ({}))) as { note?: string }
    note = body.note?.trim() || undefined
  } catch {
    /* note is optional */
  }

  try {
    const row = await requestVerification(supabase, user.id, user.role ?? 'unknown', note)
    return NextResponse.json({ status: row.status })
  } catch (err) {
    if (err instanceof VerificationError) {
      const status = err.code === 'ALREADY_PENDING' ? 409 : 500
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
    }
    throw err
  }
}
