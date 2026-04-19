import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser, lockRole, AuthError } from '@/lib/supabase/auth'

const SELECTABLE_ROLES = ['athlete', 'team', 'brand', 'agent'] as const
type SelectableRole = (typeof SELECTABLE_ROLES)[number]

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
  const { role } = body as { role?: string }

  if (!role || !SELECTABLE_ROLES.includes(role as SelectableRole)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_ROLE',
          message: 'Role must be one of: athlete, team, brand, agent',
        },
      },
      { status: 400 }
    )
  }

  try {
    await lockRole(supabase, user.id, role as SelectableRole)
    return NextResponse.json({ role })
  } catch (err) {
    if (err instanceof AuthError && err.code === 'ROLE_ALREADY_LOCKED') {
      return NextResponse.json(
        {
          error: {
            code: 'ROLE_ALREADY_LOCKED',
            message: 'Role has already been set and cannot be changed',
          },
        },
        { status: 400 }
      )
    }
    throw err
  }
}
