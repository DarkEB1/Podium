import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { revokeSession } from '@/lib/supabase/sessions'

/** Revoke one of the caller's own active sessions. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  const { id } = await params
  // revokeSession is scoped to user_id, so a caller can only revoke their own.
  await revokeSession(createAdminClient(), user.id, id)
  return NextResponse.json({ ok: true })
}
