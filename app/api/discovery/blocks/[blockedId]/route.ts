import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { unblockUser } from '@/lib/supabase/discovery'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ blockedId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { blockedId } = await params
  await unblockUser(supabase, user.id, blockedId)
  return NextResponse.json({ success: true })
}
