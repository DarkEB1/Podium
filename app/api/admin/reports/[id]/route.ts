import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getReport, resolveReport, createAuditLog } from '@/lib/supabase/admin'
import { readJsonBody, safeErrorResponse } from '@/lib/api/errors'
import type { Database } from '@/types/database'

type ReportStatus = Database['public']['Enums']['report_status']

const VALID_STATUSES: ReportStatus[] = ['pending', 'under_review', 'resolved', 'dismissed']

const REPORT_ERROR_STATUS: Record<string, number> = {
  REPORT_NOT_FOUND: 404,
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    )
  }

  const { id } = await params
  const adminSupabase = createAdminClient()

  try {
    const report = await getReport(adminSupabase, id)
    return NextResponse.json(report)
  } catch (err) {
    const response = safeErrorResponse(err, {
      scope: 'admin/reports',
      statusByCode: REPORT_ERROR_STATUS,
      safeToShow: ['REPORT_NOT_FOUND'],
    })
    if (response) return response
    throw err
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    )
  }

  const parsed = await readJsonBody(request)
  if ('response' in parsed) return parsed.response
  const { status, admin_notes } = parsed.body as { status?: ReportStatus; admin_notes?: string }

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: `status must be one of: ${VALID_STATUSES.join(', ')}` } },
      { status: 400 }
    )
  }

  const { id } = await params
  const adminSupabase = createAdminClient()

  try {
    const report = await resolveReport(adminSupabase, id, user.id, {
      status,
      ...(admin_notes !== undefined ? { admin_notes } : {}),
    })

    // WS-ADMIN-01: moderation of a report is audited. Best-effort so a logging
    // failure does not undo the resolution the admin just made.
    try {
      await createAuditLog(adminSupabase, {
        actor_id: user.id,
        action: `report_${status}`,
        target_type: 'report',
        target_id: id,
        metadata: {
          status,
          ...(typeof admin_notes === 'string' && admin_notes.length > 0 ? { admin_notes } : {}),
        },
      })
    } catch (logErr) {
      console.error('[admin/reports] audit log failed', logErr)
    }

    return NextResponse.json(report)
  } catch (err) {
    const response = safeErrorResponse(err, {
      scope: 'admin/reports',
      statusByCode: REPORT_ERROR_STATUS,
      safeToShow: ['REPORT_NOT_FOUND'],
    })
    if (response) return response
    throw err
  }
}
