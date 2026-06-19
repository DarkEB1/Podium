import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { respondToProposal, DealsError } from '@/lib/supabase/deals'
import { sendProposalRespondedEmail } from '@/lib/notifications/email'
import type { SupabaseClient } from '@supabase/supabase-js'

const VALID_ACTIONS = new Set(['accepted', 'declined'])

export async function POST(
  request: NextRequest,
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

  const body = (await request.json()) as { action?: string }

  if (!body.action) {
    return NextResponse.json(
      { error: { code: 'MISSING_ACTION', message: 'action is required' } },
      { status: 400 }
    )
  }

  if (!VALID_ACTIONS.has(body.action)) {
    return NextResponse.json(
      { error: { code: 'INVALID_ACTION', message: 'action must be accepted or declined' } },
      { status: 400 }
    )
  }

  const { proposalId } = await params
  const adminSupabase = createAdminClient()

  try {
    const proposal = await respondToProposal(
      supabase,
      adminSupabase,
      proposalId,
      user.id,
      body.action as 'accepted' | 'declined'
    )

    // Fire-and-forget: notify proposal sender of the response
    ;(async () => {
      try {
        const { data: sender } = await (adminSupabase as SupabaseClient)
          .from('users')
          .select('email')
          .eq('id', proposal.sender_id)
          .single()
        if (sender?.email) {
          await sendProposalRespondedEmail(
            sender.email,
            proposal.title,
            body.action as 'accepted' | 'declined',
            user.email
          )
        }
      } catch { /* email failure must not affect response */ }
    })()

    return NextResponse.json(proposal)
  } catch (err) {
    if (err instanceof DealsError) {
      if (err.code === 'PROPOSAL_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'PROPOSAL_NOT_FOUND', message: err.message } },
          { status: 404 }
        )
      }
      if (err.code === 'PROPOSAL_NOT_PENDING') {
        return NextResponse.json(
          { error: { code: 'PROPOSAL_NOT_PENDING', message: err.message } },
          { status: 409 }
        )
      }
      if (err.code === 'NOT_RECIPIENT') {
        return NextResponse.json(
          { error: { code: 'NOT_RECIPIENT', message: err.message } },
          { status: 403 }
        )
      }
      if (err.code === 'CONTRACT_CREATE_FAILED' || err.code === 'MATCH_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: 500 }
        )
      }
    }
    throw err
  }
}
