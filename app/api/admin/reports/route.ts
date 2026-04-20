import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getReports, AdminError } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type ReportStatus = Database['public']['Enums']['report_status']

const VALID_STATUSES: ReportStatus[] = ['pending', 'under_review', 'resolved', 'dismissed']

export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl
  const statusParam = searchParams.get('status')
  const status = statusParam && VALID_STATUSES.includes(statusParam as ReportStatus)
    ? (statusParam as ReportStatus)
    : undefined

  const adminSupabase = createAdminClient()

  try {
    const reports = await getReports(adminSupabase, { ...(status ? { status } : {}) })
    return NextResponse.json(reports)
  } catch (err) {
    if (err instanceof AdminError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 500 }
      )
    }
    throw err
  }
}
