import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { reviewVerification } from '@/lib/supabase/verification'
import { createAuditLog } from '@/lib/supabase/admin'
import { safeErrorResponse } from '@/lib/api/errors'

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
  const admin = createAdminClient()
  try {
    const row = await reviewVerification(admin, id, user.id, body.action, body.note)

    // WS-ADMIN-01: verification decisions are audited, and the review `note`
    // (previously dropped from any log) is preserved here. Best-effort.
    try {
      await createAuditLog(admin, {
        actor_id: user.id,
        action: `verification_${body.action}`,
        target_type: 'verification_request',
        target_id: id,
        metadata: {
          status: row.status,
          ...(typeof body.note === 'string' && body.note.length > 0 ? { note: body.note } : {}),
        },
      })
    } catch (logErr) {
      console.error('[admin/verification] audit log failed', logErr)
    }

    return NextResponse.json({ status: row.status })
  } catch (err) {
    // VerificationError carries raw driver text on REVIEW_FAILED; sanitize it.
    const response = safeErrorResponse(err, { scope: 'admin/verification' })
    if (response) return response
    throw err
  }
}
