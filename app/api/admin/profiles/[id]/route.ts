import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { updateProfileStatus, AdminError, type AdminProfileType, type AdminProfileStatus } from '@/lib/supabase/admin'

const VALID_ACTIONS = new Set(['approve', 'reject'])
const VALID_PROFILE_TYPES = new Set<AdminProfileType>(['athlete', 'brand'])

const STATUS_FOR_ACTION: Record<AdminProfileType, Record<string, AdminProfileStatus>> = {
  athlete: { approve: 'active', reject: 'deactivated' },
  brand: { approve: 'active', reject: 'rejected' },
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

  const body = (await request.json()) as { action?: string; profile_type?: string; reason?: string }
  const { action, profile_type } = body

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
    return NextResponse.json({ id, profile_type: profileType, status })
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
