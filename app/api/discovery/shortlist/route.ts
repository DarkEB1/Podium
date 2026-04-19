import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getShortlist, addToShortlist, DiscoveryError } from '@/lib/supabase/discovery'

export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const shortlist = await getShortlist(supabase, user.id)
  return NextResponse.json(shortlist)
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

  const body = (await request.json()) as { target_user_id?: string }
  const { target_user_id } = body

  if (!target_user_id) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'target_user_id is required' } },
      { status: 400 }
    )
  }

  try {
    const entry = await addToShortlist(supabase, user.id, target_user_id)
    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    if (err instanceof DiscoveryError && err.code === 'ALREADY_SHORTLISTED') {
      return NextResponse.json(
        { error: { code: 'ALREADY_SHORTLISTED', message: err.message } },
        { status: 409 }
      )
    }
    throw err
  }
}
