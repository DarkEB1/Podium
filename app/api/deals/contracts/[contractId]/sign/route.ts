import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { signContract, DealsError } from '@/lib/supabase/deals'
import { buildGuardianDealNotice } from '@/lib/supabase/guardian'
import { sendGuardianDealNoticeEmail } from '@/lib/email/guardian'
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
