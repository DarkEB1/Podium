import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { createReport, getOwnReports, AdminError } from '@/lib/supabase/admin'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import { REPORT_DETAIL_MAX } from '@/lib/limits'
import { Constants, type Database } from '@/types/database'

type ReportReason = Database['public']['Enums']['report_reason']

/** The enum Postgres will accept, straight from the generated types. */
const REPORT_REASONS = new Set<string>(Constants.public.Enums.report_reason)

/**
 * An AdminError message is raw driver text ("invalid input value for enum
 * report_reason: ..."), which names internal enums, columns and types. It is
 * logged server-side and replaced with copy the reporter can act on.
 */
function reportErrorResponse(scope: string, err: AdminError): NextResponse {
  console.error(`[reports] ${scope} failed`, err.code, err.message)
  return NextResponse.json(
    {
      error: {
        code: err.code,
        message: 'Something went wrong on our end. Please try again in a moment.',
      },
    },
    { status: 500 }
  )
}

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  try {
    const reports = await getOwnReports(supabase, user.id)
    return NextResponse.json(reports)
  } catch (err) {
    if (err instanceof AdminError) return reportErrorResponse('fetch', err)
    throw err
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // DH-2: report spam floods the moderation queue — limited per user in its
  // own key namespace.
  const limited = await consume(userKey('report_create', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  const body = await request.json()
  const { reported_user_id, reported_message_id, reason, detail } = body

  if (!reason) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'reason is required' } },
      { status: 400 }
    )
  }

  // A value outside the enum is a client mistake, so it is refused here with a
  // 400. Passed through it reached Postgres, which rejected the insert with
  // text naming the enum and returned it to the browser as a 500.
  if (typeof reason !== 'string' || !REPORT_REASONS.has(reason)) {
    return NextResponse.json(
      { error: { code: 'INVALID_REASON', message: 'Invalid reason value' } },
      { status: 400 }
    )
  }

  if (!reported_user_id && !reported_message_id) {
    return NextResponse.json(
      { error: { code: 'MISSING_TARGET', message: 'reported_user_id or reported_message_id is required' } },
      { status: 400 }
    )
  }

  // `detail` is an unbounded text column with no CHECK constraint, and every
  // report lands in the moderation queue a human reads.
  if (typeof detail === 'string' && detail.length > REPORT_DETAIL_MAX) {
    return NextResponse.json(
      {
        error: {
          code: 'DETAIL_TOO_LONG',
          message: `Detail must be ${REPORT_DETAIL_MAX} characters or fewer`,
        },
      },
      { status: 400 }
    )
  }

  try {
    const report = await createReport(supabase, user.id, {
      // Narrowed by REPORT_REASONS above, which is the generated enum list.
      reason: reason as ReportReason,
      ...(reported_user_id ? { reported_user_id } : {}),
      ...(reported_message_id ? { reported_message_id } : {}),
      ...(detail !== undefined ? { detail } : {}),
    })
    return NextResponse.json(report, { status: 201 })
  } catch (err) {
    if (err instanceof AdminError) return reportErrorResponse('create', err)
    throw err
  }
}
