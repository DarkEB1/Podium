import { type NextRequest } from 'next/server'
import { runCountingCronJob } from '@/lib/cron/run'

/**
 * Guardian-consent-expiry purge (2.5 / spec Flow 18). Removes consumed or
 * expired guardian consent tokens via purge_expired_guardian_consent_tokens().
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function handle(request: NextRequest) {
  return runCountingCronJob(request, {
    route: '/api/cron/guardian-consent-expiry',
    job: 'guardian-consent-expiry',
    fn: 'purge_expired_guardian_consent_tokens',
    resultKey: 'tokens_purged',
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
