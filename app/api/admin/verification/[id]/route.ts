import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { reviewVerification, VerificationError } from '@/lib/supabase/verification'

/** Admin: approve or reject a verification request. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admins only' } }, { status: 403 })
  }

  let body: { action?: string; note?: string }
  try {
    body = (await request.json()) as { action?: string; note?: string }
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, { status: 400 })
  }
  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ error: { code: 'INVALID_ACTION', message: 'action must be approve or reject' } }, { status: 400 })
  }

  const { id } = await params
  try {
    const row = await reviewVerification(createAdminClient(), id, user.id, body.action, body.note)
    return NextResponse.json({ status: row.status })
  } catch (err) {
    if (err instanceof VerificationError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 500 })
    }
    throw err
  }
}
