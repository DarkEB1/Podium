import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser, getUserRole } from '@/lib/supabase/auth'
import { respondToProposal, DealsError } from '@/lib/supabase/deals'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import { sendTransactionalEmail } from '@/lib/email'
import { absoluteUrl, nameOf, resolveDisplayNames } from '@/lib/email/notify'
import { dispatchNotification } from '@/lib/notifications'
import { dealDetailPath } from '@/lib/notifications/deep-links'

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

  // DH-2: accepting a proposal creates a contract, so this is a state change
  // worth limiting per user in its own key namespace.
  const limited = await consume(userKey('proposal_respond', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

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

    // On a successful ACCEPT (the accept RPC also created the contract), email
    // the proposal's ORIGINAL SENDER that their proposal was accepted. The
    // accepted row carries sender_id and title directly, so no extra read is
    // needed. Side effect only — the email layer never throws.
    if (body.action === 'accepted') {
      const names = await resolveDisplayNames(adminSupabase, [proposal.sender_id])
      // D20: "Review contract" must open the sender's deal detail for the
      // accepted proposal (a contract now exists there), not /dashboard.
      const senderRole = await getUserRole(adminSupabase, proposal.sender_id)
      const path = dealDetailPath(senderRole, proposal.id)
      await sendTransactionalEmail(adminSupabase, {
        event: 'proposal_accepted',
        userId: proposal.sender_id,
        data: {
          recipientName: nameOf(names, proposal.sender_id),
          proposalTitle: proposal.title,
          url: absoluteUrl(path),
        },
      })

      // WS-MSG-01: in-app bell copy for the proposal's original sender.
      try {
        await dispatchNotification(adminSupabase, {
          userId: proposal.sender_id,
          eventType: 'proposal_accepted',
          title: 'Proposal accepted',
          body: `Your proposal "${proposal.title}" was accepted.`,
          metadata: { url: path },
        })
      } catch (notifyErr) {
        console.error('[proposals/respond] notification dispatch failed', notifyErr)
      }
    }

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
