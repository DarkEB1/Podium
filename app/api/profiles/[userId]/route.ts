import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPublicProfile, type ProfileRole } from '@/lib/supabase/profiles'

const VALID_ROLES: ProfileRole[] = ['athlete', 'team', 'brand', 'agent']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const role = request.nextUrl.searchParams.get('role')

  if (!role) {
    return NextResponse.json(
      { error: { code: 'MISSING_ROLE', message: 'role query parameter is required' } },
      { status: 400 }
    )
  }

  if (!VALID_ROLES.includes(role as ProfileRole)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_ROLE',
          message: `role must be one of: ${VALID_ROLES.join(', ')}`,
        },
      },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const profile = await getPublicProfile(supabase, userId, role as ProfileRole)

  if (!profile) {
    return NextResponse.json(
      { error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found or not active' } },
      { status: 404 }
    )
  }

  return NextResponse.json(profile)
}
