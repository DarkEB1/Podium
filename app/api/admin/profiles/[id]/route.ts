import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  updateProfileStatus,
  createAuditLog,
  type AdminProfileType,
  type AdminProfileStatus,
} from '@/lib/supabase/admin'
import { readJsonBody, safeErrorResponse } from '@/lib/api/errors'

const VALID_ACTIONS = new Set(['approve', 'reject'])
const VALID_PROFILE_TYPES = new Set<AdminProfileType>(['athlete', 'brand'])

// WS-ADMIN-01: athlete reject writes 'suspended' (service-role-only), NOT
// 'deactivated'. 'deactivated' is the athlete's own toggle value, so publish
// let them undo the moderation decision; 'suspended' is a state the athlete
// cannot leave (20260904000902).
const STATUS_FOR_ACTION: Record<AdminProfileType, Record<string, AdminProfileStatus>> = {
  athlete: { approve: 'active', reject: 'suspended' },
  brand: { approve: 'active', reject: 'rejected' },
}

const PROFILE_ERROR_STATUS: Record<string, number> = {
  PROFILE_NOT_FOUND: 404,
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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
  const { action, profile_type, reason } = parsed.body as {
    action?: string
    profile_type?: string
    reason?: string
  }

  if (!action || !VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: { code: 'INVALID_ACTION', message: 'action must be "approve" or "reject"' } },
      { status: 400 }
    )
  }

  if (!profile_type || !VALID_PROFILE_TYPES.has(profile_type as AdminProfileType)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PROFILE_TYPE', message: 'profile_type must be "athlete" or "brand"' } },
      { status: 400 }
    )
  }

  const profileType = profile_type as AdminProfileType
  const status = STATUS_FOR_ACTION[profileType][action] as AdminProfileStatus

  try {
    const adminClient = createAdminClient()
    await updateProfileStatus(adminClient, id, profileType, status, user.id)

    // WS-ADMIN-01: every admin moderation action is recorded. Best-effort — the
    // status change already committed, so a logging failure must not turn a
    // successful moderation into an error for the admin. The `reason` (dropped
    // before) is preserved here.
    try {
      await createAuditLog(adminClient, {
        actor_id: user.id,
        action: `profile_${action}`,
        target_type: `${profileType}_profile`,
        target_id: id,
        metadata: {
          status,
          ...(typeof reason === 'string' && reason.length > 0 ? { reason } : {}),
        },
      })
    } catch (logErr) {
      console.error('[admin/profiles] audit log failed', logErr)
    }

    return NextResponse.json({ id, profile_type: profileType, status })
  } catch (err) {
    const response = safeErrorResponse(err, {
      scope: 'admin/profiles',
      statusByCode: PROFILE_ERROR_STATUS,
      safeToShow: ['PROFILE_NOT_FOUND'],
      fallbackStatus: 500,
      fallbackMessage: 'We could not update that profile. Please try again.',
    })
    if (response) return response
    throw err
  }
}
