import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser, getUserRole } from '@/lib/supabase/auth'
import { signContract, DealsError } from '@/lib/supabase/deals'
import { buildGuardianDealNotice } from '@/lib/supabase/guardian'
import { sendGuardianDealNoticeEmail } from '@/lib/email/guardian'
import { sendTransactionalEmail } from '@/lib/email'
import { absoluteUrl, nameOf, resolveDisplayNames, FALLBACK_OTHER_NAME } from '@/lib/email/notify'
import { dispatchNotification } from '@/lib/notifications'
import { dealDetailPath } from '@/lib/notifications/deep-links'
import { clientIpFrom } from '@/lib/rate-limit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { contractId } = await params
  const adminSupabase = createAdminClient()

  try {
    // QA-1.6 / spec 11.6: a signature event records where it came from, not just
    // when. Only this layer can see the request, so the audit values are read
    // here and handed to signContract.
    const contract = await signContract(supabase, adminSupabase, contractId, user.id, {
      ip: clientIpFrom(request.headers),
      device: request.headers.get('user-agent'),
    })

    // 2.3 hybrid half: when the signer is an under-18 athlete, send the guardian
    // an informational notice of the signed deal. Best-effort and never blocks
    // the signature: the notice builder returns null for adults/teams and the
    // guardian mailer never throws.
    if (contract.athlete_or_team_id === user.id) {
      try {
        const notice = await buildGuardianDealNotice(adminSupabase, {
          brand_id: contract.brand_id,
          athlete_or_team_id: contract.athlete_or_team_id,
          proposal_id: contract.proposal_id,
        })
        if (notice) await sendGuardianDealNoticeEmail(notice)
      } catch {
        // A notice failure must not fail the signature.
      }
    }

    // WS-MSG-09: when THIS signature completes the contract, tell BOTH parties
    // it is fully signed — email + in-app. Never fired before (the template and
    // the settings toggle existed, but nothing called it). Keyed per recipient
    // so a concurrent double-sign or a client retry cannot double-send. Fully
    // guarded: a notification failure must never fail the signature itself.
    if (contract.status === 'fully_signed') {
      try {
        const parties: Array<{ userId: string; otherId: string }> = [
          { userId: contract.brand_id, otherId: contract.athlete_or_team_id },
          { userId: contract.athlete_or_team_id, otherId: contract.brand_id },
        ]
        const names = await resolveDisplayNames(adminSupabase, [
          contract.brand_id,
          contract.athlete_or_team_id,
        ])
        await Promise.all(
          parties.map(async ({ userId, otherId }) => {
            const role = await getUserRole(adminSupabase, userId)
            const path = dealDetailPath(role, contract.proposal_id)
            await sendTransactionalEmail(adminSupabase, {
              event: 'contract_fully_signed',
              userId,
              idempotencyKey: `contract_fully_signed:${contractId}:${userId}`,
              data: {
                recipientName: nameOf(names, userId),
                counterpartyName: nameOf(names, otherId, FALLBACK_OTHER_NAME),
                url: absoluteUrl(path),
              },
            })
            await dispatchNotification(adminSupabase, {
              userId,
              eventType: 'contract_fully_signed',
              title: 'Contract fully signed',
              body: 'Your contract is now signed by both parties.',
              metadata: { url: path },
            })
          })
        )
      } catch (notifyErr) {
        console.error('[contracts/sign] fully-signed notification failed', notifyErr)
      }
    }

    return NextResponse.json(contract)
  } catch (err) {
    if (err instanceof DealsError) {
      if (err.code === 'CONTRACT_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'CONTRACT_NOT_FOUND', message: err.message } },
          { status: 404 }
        )
      }
      if (err.code === 'NOT_PARTICIPANT') {
        return NextResponse.json(
          { error: { code: 'NOT_PARTICIPANT', message: err.message } },
          { status: 403 }
        )
      }
      if (err.code === 'ALREADY_SIGNED') {
        return NextResponse.json(
          { error: { code: 'ALREADY_SIGNED', message: err.message } },
          { status: 409 }
        )
      }
      if (err.code === 'GUARDIAN_CONSENT_REQUIRED') {
        return NextResponse.json(
          { error: { code: 'GUARDIAN_CONSENT_REQUIRED', message: err.message } },
          { status: 403 }
        )
      }
    }
    throw err
  }
}
