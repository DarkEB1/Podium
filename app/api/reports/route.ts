import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { createReport, getOwnReports } from '@/lib/supabase/admin'
import { readJsonBody, safeErrorResponse, isUuid } from '@/lib/api/errors'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import { REPORT_DETAIL_MAX } from '@/lib/limits'
import { Constants, type Database } from '@/types/database'

type ReportReason = Database['public']['Enums']['report_reason']

/** The enum Postgres will accept, straight from the generated types. */
const REPORT_REASONS = new Set<string>(Constants.public.Enums.report_reason)

/**
 * Codes carrying a user-facing message we wrote (a bad target, a duplicate) keep
 * it and their own status. Everything else — REPORT_CREATE_FAILED /
 * REPORTS_FETCH_FAILED — holds raw driver text and is logged, then replaced with
 * a generic 500.
 */
const REPORT_ERROR_STATUS: Record<string, number> = {
  REPORT_TARGET_NOT_FOUND: 404,
  DUPLICATE_REPORT: 409,
}
const REPORT_SAFE_CODES = ['REPORT_TARGET_NOT_FOUND', 'DUPLICATE_REPORT']

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
    const response = safeErrorResponse(err, {
      scope: 'reports/fetch',
      statusByCode: REPORT_ERROR_STATUS,
      safeToShow: REPORT_SAFE_CODES,
    })
    if (response) return response
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

  const parsed = await readJsonBody(request)
  if ('response' in parsed) return parsed.response
  const { reported_user_id, reported_message_id, reason, detail } = parsed.body as {
    reported_user_id?: unknown
    reported_message_id?: unknown
    reason?: unknown
    detail?: unknown
  }

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

  // A user cannot report themselves. Unchecked, this filled the queue with
  // self-reports; the FK is valid so it inserted cleanly. Checked before the
  // UUID shape so "report yourself" is the message a real self-report gets.
  if (reported_user_id && reported_user_id === user.id) {
    return NextResponse.json(
      { error: { code: 'SELF_REPORT', message: 'You cannot report yourself' } },
      { status: 400 }
    )
  }

  // A non-UUID id reached Postgres as SQLSTATE 22P02 and came back as a 500 with
  // raw driver text. Validate the shape up front.
  if (reported_user_id !== undefined && reported_user_id !== null && !isUuid(reported_user_id)) {
    return NextResponse.json(
      { error: { code: 'INVALID_TARGET', message: 'reported_user_id must be a valid id' } },
      { status: 400 }
    )
  }
  if (reported_message_id !== undefined && reported_message_id !== null && !isUuid(reported_message_id)) {
    return NextResponse.json(
      { error: { code: 'INVALID_TARGET', message: 'reported_message_id must be a valid id' } },
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
      // Both ids validated as UUID strings (or absent) above.
      ...(reported_user_id ? { reported_user_id: reported_user_id as string } : {}),
      ...(reported_message_id ? { reported_message_id: reported_message_id as string } : {}),
      ...(typeof detail === 'string' ? { detail } : {}),
    })
    return NextResponse.json(report, { status: 201 })
  } catch (err) {
    const response = safeErrorResponse(err, {
      scope: 'reports/create',
      statusByCode: REPORT_ERROR_STATUS,
      safeToShow: REPORT_SAFE_CODES,
    })
    if (response) return response
    throw err
  }
}
