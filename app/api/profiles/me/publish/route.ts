import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { publishProfile, ProfileError, type ProfileRole } from '@/lib/supabase/profiles'

const PROFILE_ROLES = new Set<string>(['athlete', 'team', 'agent'])

export async function POST() {
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
      { error: { code: 'FORBIDDEN', message: 'Only athletes, teams and agents can publish' } },
      { status: 403 }
    )
  }

  try {
    await publishProfile(supabase, user.id, user.role as ProfileRole)
    return NextResponse.json({ message: 'Profile published' })
  } catch (err) {
    if (err instanceof ProfileError) {
      if (err.code === 'PROFILE_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'PROFILE_NOT_FOUND', message: err.message } },
          { status: 404 }
        )
      }
    }
    throw err
  }
}
