import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAuthorizedCronRequest, cronUnauthorized } from '@/lib/cron/auth'
import { withRequestContext } from '@/lib/observability'
import { processPendingExports } from '@/lib/supabase/data-export'

/**
 * GDPR data-export fulfilment cron. Assembles pending "download my data"
 * requests into a signed 72h JSON file. CRON_SECRET-gated like the other jobs.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handle(request: NextRequest) {
  const obs = withRequestContext({ route: '/api/cron/data-export', job: 'data-export' })

  if (!process.env.CRON_SECRET) {
    obs.captureMessage(
      'CRON_SECRET is not configured, so the data-export job cannot authenticate and will never run',
      'error'
    )
  }
  if (!isAuthorizedCronRequest(request)) {
    obs.captureMessage('Rejected an unauthorised cron invocation', 'warning')
    return cronUnauthorized()
  }

  try {
    const admin = createAdminClient()
    const result = await processPendingExports(admin, new Date().toISOString())
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    obs.captureException(err, { stage: 'processPendingExports' })
    const message = err instanceof Error ? err.message : 'Data-export job failed'
    return NextResponse.json({ error: { code: 'DATA_EXPORT_FAILED', message } }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
