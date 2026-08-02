import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCronRequest, cronUnauthorized } from '@/lib/cron/auth'
import { withRequestContext } from '@/lib/observability'
import { DAILY_CRON_JOBS } from '@/lib/cron/daily-jobs'

/**
 * Consolidated daily runner for the Vercel Hobby plan's two-cron limit: runs
 * every job in DAILY_CRON_JOBS sequentially instead of each job having its own
 * schedule. Sub-handlers re-check CRON_SECRET on the forwarded request, so no
 * job is reachable with weaker auth than it had as a standalone schedule.
 *
 * A failing job never stops the ones after it; the response reports per-job
 * status and the overall status is 500 if any failed, so a partial failure is
 * visible in the Vercel cron logs.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(request: NextRequest) {
  const obs = withRequestContext({ route: '/api/cron/daily', job: 'daily' })

  // Same DH-6 rationale as the individual jobs: an unset secret means nothing
  // ever runs, and that must not be silent.
  if (!process.env.CRON_SECRET) {
    obs.captureMessage(
      'CRON_SECRET is not configured, so the scheduled daily job cannot authenticate and will never run',
      'error'
    )
  }
  if (!isAuthorizedCronRequest(request)) {
    obs.captureMessage('Rejected an unauthorised cron invocation', 'warning')
    return cronUnauthorized()
  }

  const results: { path: string; status: number; body: unknown }[] = []
  for (const job of DAILY_CRON_JOBS) {
    try {
      const res = await job.run(request)
      const body: unknown = await res.json().catch(() => null)
      results.push({ path: job.path, status: res.status, body })
    } catch (err) {
      obs.captureException(err, { stage: job.path })
      results.push({ path: job.path, status: 500, body: null })
    }
  }

  const failed = results.filter((r) => r.status >= 400).map((r) => r.path)
  return NextResponse.json(
    { ok: failed.length === 0, failed, results },
    { status: failed.length === 0 ? 200 : 500 }
  )
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
