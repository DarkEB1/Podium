import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getBlocks, blockUser, DiscoveryError } from '@/lib/supabase/discovery'

export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const blocks = await getBlocks(supabase, user.id)
  return NextResponse.json(blocks)
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

  const body = (await request.json()) as { blocked_id?: string }
  const { blocked_id } = body

  if (!blocked_id) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'blocked_id is required' } },
      { status: 400 }
    )
  }

  try {
    const block = await blockUser(supabase, user.id, blocked_id)
    return NextResponse.json(block, { status: 201 })
  } catch (err) {
    if (err instanceof DiscoveryError && err.code === 'ALREADY_BLOCKED') {
      return NextResponse.json(
        { error: { code: 'ALREADY_BLOCKED', message: err.message } },
        { status: 409 }
      )
    }
    throw err
  }
}
