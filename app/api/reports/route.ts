import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { createReport, getOwnReports, AdminError } from '@/lib/supabase/admin'

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
    if (err instanceof AdminError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 500 }
      )
    }
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

  const body = await request.json()
  const { reported_user_id, reported_message_id, reason, detail } = body

  if (!reason) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'reason is required' } },
      { status: 400 }
    )
  }

  if (!reported_user_id && !reported_message_id) {
    return NextResponse.json(
      { error: { code: 'MISSING_TARGET', message: 'reported_user_id or reported_message_id is required' } },
      { status: 400 }
    )
  }

  try {
    const report = await createReport(supabase, user.id, {
      reason,
      ...(reported_user_id ? { reported_user_id } : {}),
      ...(reported_message_id ? { reported_message_id } : {}),
      ...(detail !== undefined ? { detail } : {}),
    })
    return NextResponse.json(report, { status: 201 })
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
