import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { publishProfile, ProfileError, type ProfileRole } from '@/lib/supabase/profiles'

export async function POST() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (!user.role) {
    return NextResponse.json(
      { error: { code: 'ROLE_NOT_SET', message: 'Role must be set before publishing' } },
      { status: 400 }
    )
  }

  try {
    await publishProfile(supabase, user.id, user.role as ProfileRole)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ProfileError) {
      if (err.code === 'PROFILE_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'PROFILE_NOT_FOUND', message: err.message } },
          { status: 404 }
        )
      }
      if (err.code === 'BRAND_NOT_PUBLISHABLE') {
        return NextResponse.json(
          { error: { code: 'BRAND_NOT_PUBLISHABLE', message: err.message } },
          { status: 400 }
        )
      }
    }
    throw err
  }
}
