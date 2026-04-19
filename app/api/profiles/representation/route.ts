import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  createRepresentationLink,
  getOwnProfile,
  getRepresentationLinks,
} from '@/lib/supabase/profiles'

export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const links = await getRepresentationLinks(supabase, user.id)
  return NextResponse.json(links)
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

  if (user.role !== 'agent') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only agents can create representation links' } },
      { status: 403 }
    )
  }

  const body = (await request.json()) as { client_user_id?: string; client_role?: string }
  const { client_user_id, client_role } = body

  if (!client_user_id || !client_role) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'client_user_id and client_role are required' } },
      { status: 400 }
    )
  }

  if (client_role !== 'athlete' && client_role !== 'team') {
    return NextResponse.json(
      { error: { code: 'INVALID_CLIENT_ROLE', message: 'client_role must be athlete or team' } },
      { status: 400 }
    )
  }

  const agentProfile = await getOwnProfile(supabase, user.id, 'agent')

  if (!agentProfile) {
    return NextResponse.json(
      { error: { code: 'AGENT_PROFILE_NOT_FOUND', message: 'Agent profile not found' } },
      { status: 404 }
    )
  }

  const link = await createRepresentationLink(
    supabase,
    agentProfile.id,
    client_user_id,
    client_role
  )

  return NextResponse.json(link, { status: 201 })
}
