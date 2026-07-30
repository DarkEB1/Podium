import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { processScheduledDeletions } from '@/lib/supabase/auth'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { withRequestContext } from '@/lib/observability'

/**
 * DI-4 / CL-3 — Vercel Cron entry point for GDPR erasure.
 *
 * Runs `public.process_scheduled_deletions()` with the service-role client for
 * every user whose 14-day grace period has expired. Schedule lives in
 * vercel.json.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`, compared in constant time.
 * Anything else — missing header, wrong scheme, wrong secret, or an unset
 * CRON_SECRET — is a 401. Vercel Cron sends exactly this header when
 * CRON_SECRET is set as an environment variable on the project.
 */

// The service-role client and the erasure job must never be prerendered or
// cached; this route has to execute on every invocation.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Max users erased per invocation — keeps the request inside the time limit. */
const BATCH_LIMIT = 100

// Guard shared with every other cron route — see lib/cron/auth.ts.
const isAuthorized = isAuthorizedCronRequest

async function handle(request: NextRequest) {
  const obs = withRequestContext({ route: '/api/cron/gdpr-deletion', job: 'gdpr-deletion' })

  // ST-2/SEC-5 + DH-6: with the secret unset this job 401s forever and erasure
  // silently never happens — a statutory deadline missed with no signal at all.
  // Now it is a queryable log line every time the scheduler calls.
  if (!process.env.CRON_SECRET) {
    obs.captureMessage(
      'CRON_SECRET is not configured, so the scheduled GDPR erasure job cannot authenticate and will never run',
      'error'
    )
  }

  if (!isAuthorized(request)) {
    obs.captureMessage('Rejected an unauthorised cron invocation', 'warning')
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron credentials' } },
      { status: 401 }
    )
  }

  try {
    const summary = await processScheduledDeletions(createAdminClient(), BATCH_LIMIT)

    // Counts only — never a user id or any residual personal data.
    if (summary.failed > 0) {
      obs.captureMessage('GDPR erasure completed with failures', 'error', {
        erased: summary.erased,
        failed: summary.failed,
      })
    }

    return NextResponse.json({
      ok: true,
      processed_at: summary.processed_at,
      erased: summary.erased,
      failed: summary.failed,
      // Per-user detail is intentionally reduced to ids and statuses — a cron
      // response should not echo any residual personal data into logs.
      results: summary.results.map((r) => ({ user_id: r.user_id, status: r.status })),
    })
  } catch (err) {
    obs.captureException(err, { stage: 'process_scheduled_deletions' })
    const message = err instanceof Error ? err.message : 'Erasure job failed'
    return NextResponse.json(
      { error: { code: 'GDPR_DELETION_FAILED', message } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

// Vercel Cron issues GET; POST is accepted so the job can be triggered manually
// by an operator with the secret (for example after an incident).
export async function POST(request: NextRequest) {
  return handle(request)
}
