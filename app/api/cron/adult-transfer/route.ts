import { type NextRequest } from 'next/server'
import { runCountingCronJob } from '@/lib/cron/run'

/**
 * 18th-birthday control transfer (2.5 / spec Flow 18). Clears is_under_18 for
 * athletes who have reached 18 via transfer_control_for_new_adults(), lifting
 * the guardian-consent sign gate.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function handle(request: NextRequest) {
  return runCountingCronJob(request, {
    route: '/api/cron/adult-transfer',
    job: 'adult-transfer',
    fn: 'transfer_control_for_new_adults',
    resultKey: 'profiles_transferred',
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
