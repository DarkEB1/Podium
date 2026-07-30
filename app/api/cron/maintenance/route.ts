import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAuthorizedCronRequest, cronUnauthorized } from '@/lib/cron/auth'
import { withRequestContext } from '@/lib/observability'

/**
 * Scheduled housekeeping.
 *
 * Currently purges expired `auth_rate_limits` rows (DH-2). Without this the
 * table accumulates one row per distinct client IP forever — the counters are
 * disposable, but nothing was deleting them.
 *
 * Auth and public-path requirements are identical to the GDPR job; see
 * lib/cron/auth.ts. Schedule lives in vercel.json.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Discard counters whose window closed more than a day ago. */
const RATE_LIMIT_RETENTION_SECONDS = 86_400

async function handle(request: NextRequest) {
  const obs = withRequestContext({ route: '/api/cron/maintenance', job: 'maintenance' })

  // See the GDPR job: an unset secret means this housekeeping never runs, and
  // before DH-6 that was completely silent.
  if (!process.env.CRON_SECRET) {
    obs.captureMessage(
      'CRON_SECRET is not configured, so the scheduled maintenance job cannot authenticate and will never run',
      'error'
    )
  }

  if (!isAuthorizedCronRequest(request)) {
    obs.captureMessage('Rejected an unauthorised cron invocation', 'warning')
    return cronUnauthorized()
  }

  try {
    const admin = createAdminClient()
    // as unknown as ...: purge_expired_rate_limits is defined in a migration and
    // is absent from the generated types/database.ts until `npm run
    // supabase:types` is re-run against the updated schema.
    const { data, error } = await (admin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>)(
      'purge_expired_rate_limits',
      { p_older_than_seconds: RATE_LIMIT_RETENTION_SECONDS }
    )

    if (error) throw new Error(error.message)

    return NextResponse.json({
      ok: true,
      rate_limit_rows_purged: typeof data === 'number' ? data : 0,
    })
  } catch (err) {
    obs.captureException(err, { stage: 'purge_expired_rate_limits' })
    const message = err instanceof Error ? err.message : 'Maintenance job failed'
    return NextResponse.json({ error: { code: 'MAINTENANCE_FAILED', message } }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
