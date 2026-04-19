import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { withdrawProposal, DealsError } from '@/lib/supabase/deals'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { proposalId } = await params

  try {
    await withdrawProposal(supabase, proposalId, user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof DealsError) {
      if (err.code === 'PROPOSAL_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'PROPOSAL_NOT_FOUND', message: err.message } },
          { status: 404 }
        )
      }
      if (err.code === 'PROPOSAL_WITHDRAW_FAILED') {
        return NextResponse.json(
          { error: { code: 'PROPOSAL_WITHDRAW_FAILED', message: err.message } },
          { status: 500 }
        )
      }
    }
    throw err
  }
}
