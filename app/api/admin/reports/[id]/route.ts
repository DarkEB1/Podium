import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getReport, resolveReport, AdminError } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type ReportStatus = Database['public']['Enums']['report_status']

const VALID_STATUSES: ReportStatus[] = ['pending', 'under_review', 'resolved', 'dismissed']

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
    if (err instanceof AdminError) {
      const status = err.code === 'REPORT_NOT_FOUND' ? 404 : 500
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status }
      )
    }
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

  const body = await request.json()
  const { status, admin_notes } = body as { status?: ReportStatus; admin_notes?: string }

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
    return NextResponse.json(report)
  } catch (err) {
    if (err instanceof AdminError) {
      const httpStatus = err.code === 'REPORT_NOT_FOUND' ? 404 : 500
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: httpStatus }
      )
    }
    throw err
  }
}
