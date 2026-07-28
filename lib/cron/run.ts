import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAuthorizedCronRequest, cronUnauthorized } from '@/lib/cron/auth'
import { withRequestContext } from '@/lib/observability'

/**
 * Shared runner for the "call one SECURITY DEFINER function that returns a row
 * count" cron jobs (2.5). Auth and CRON_SECRET handling match the existing
 * maintenance/gdpr jobs; the schedule lives in vercel.json.
 */
export async function runCountingCronJob(
  request: NextRequest,
  opts: { route: string; job: string; fn: string; resultKey: string }
): Promise<Response> {
  const obs = withRequestContext({ route: opts.route, job: opts.job })

  // An unset secret means the job can never authenticate, so it silently never
  // runs. Surface that rather than failing invisibly (matches the DH-6 fix).
  if (!process.env.CRON_SECRET) {
    obs.captureMessage(
      `CRON_SECRET is not configured — the scheduled ${opts.job} job cannot authenticate and will never run`,
      'error'
    )
  }

  if (!isAuthorizedCronRequest(request)) {
    obs.captureMessage('Rejected an unauthorised cron invocation', 'warning')
    return cronUnauthorized()
  }

  try {
    const admin = createAdminClient()
    // as unknown as ...: these functions are defined in a migration and are
    // absent from the generated types/database.ts until the types are
    // regenerated against the updated schema.
    const { data, error } = await (admin.rpc as unknown as (
      fn: string
    ) => Promise<{ data: unknown; error: { message: string } | null }>)(opts.fn)

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, [opts.resultKey]: typeof data === 'number' ? data : 0 })
  } catch (err) {
    obs.captureException(err, { stage: opts.fn })
    const message = err instanceof Error ? err.message : `${opts.job} job failed`
    return NextResponse.json({ error: { code: 'CRON_JOB_FAILED', message } }, { status: 500 })
  }
}
