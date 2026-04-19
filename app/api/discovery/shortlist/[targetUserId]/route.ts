import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { removeFromShortlist } from '@/lib/supabase/discovery'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ targetUserId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { targetUserId } = await params
  await removeFromShortlist(supabase, user.id, targetUserId)
  return NextResponse.json({ success: true })
}
