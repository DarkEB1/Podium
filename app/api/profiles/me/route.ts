import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  createProfile,
  getOwnProfile,
  updateProfile,
  ProfileError,
  type ProfileRole,
} from '@/lib/supabase/profiles'

const PROFILE_ROLES = new Set<string>(['athlete', 'team', 'brand', 'agent'])

export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (!user.role || !PROFILE_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: { code: 'ROLE_NOT_SET', message: 'Role has not been selected yet' } },
      { status: 400 }
    )
  }

  const profile = await getOwnProfile(supabase, user.id, user.role as ProfileRole)

  if (!profile) {
    return NextResponse.json(
      { error: { code: 'PROFILE_NOT_FOUND', message: 'No profile found for this user' } },
      { status: 404 }
    )
  }

  return NextResponse.json(profile)
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

  if (!user.role_locked_at) {
    return NextResponse.json(
      {
        error: {
          code: 'ROLE_NOT_LOCKED',
          message: 'Role must be locked before creating a profile',
        },
      },
      { status: 400 }
    )
  }

  if (!user.role || !PROFILE_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: { code: 'ROLE_NOT_SET', message: 'Role has not been selected yet' } },
      { status: 400 }
    )
  }

  const body = (await request.json()) as Record<string, unknown>

  try {
    const profile = await createProfile(supabase, user.id, user.role as ProfileRole, body)
    return NextResponse.json(profile, { status: 201 })
  } catch (err) {
    if (err instanceof ProfileError && err.code === 'PROFILE_ALREADY_EXISTS') {
      return NextResponse.json(
        {
          error: {
            code: 'PROFILE_ALREADY_EXISTS',
            message: 'A profile already exists for this user',
          },
        },
        { status: 409 }
      )
    }
    throw err
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (!user.role || !PROFILE_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: { code: 'ROLE_NOT_SET', message: 'Role has not been selected yet' } },
      { status: 400 }
    )
  }

  const body = (await request.json()) as Record<string, unknown>

  try {
    const profile = await updateProfile(supabase, user.id, user.role as ProfileRole, body)
    return NextResponse.json(profile)
  } catch (err) {
    if (err instanceof ProfileError && err.code === 'PROFILE_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'PROFILE_NOT_FOUND', message: 'No profile found for this user' } },
        { status: 404 }
      )
    }
    throw err
  }
}
