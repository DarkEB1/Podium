import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { requestDataExport, SettingsError } from '@/lib/supabase/settings'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'

/** Request a GDPR data export. A cron fulfils it and sets a 72h download link. */
export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  // One export request is cheap to make but expensive to fulfil; keep it bounded.
  const limited = await consume(userKey('data_export', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  try {
    const row = await requestDataExport(supabase, user.id)
    return NextResponse.json({ status: row.status })
  } catch (err) {
    if (err instanceof SettingsError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 500 })
    }
    throw err
  }
}
