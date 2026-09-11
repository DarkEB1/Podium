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
import { provider } from '@/lib/esign'

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

  const CONSENT_TEXT =
    'I agree that this is my electronic signature and I intend to be legally bound by this contract.'

  const body = await request.json().catch(() => ({}))
  const typedName = typeof body?.typedName === 'string' ? body.typedName.trim() : ''
  const consent = body?.consent === true
  const signatureImage =
    typeof body?.signatureImage === 'string' ? body.signatureImage : null
  // P2P: the payee athlete may supply bank/payment details here so the Sponsor
  // can pay directly. Raw input; recordSignature normalizes before storage.
  const paymentDetails = body?.paymentDetails ?? null
  if (!typedName || !consent) {
    return NextResponse.json(
      { error: { code: 'SIGNATURE_INVALID', message: 'A typed name and consent are required to sign.' } },
      { status: 400 }
    )
  }

  try {
    // QA-1.6 / spec 11.6: a signature event records where it came from, not just
    // when. Only this layer can see the request, so the audit values are read
    // here and handed to signContract.
    const contract = await signContract(supabase, adminSupabase, contractId, user.id, {
      ip: clientIpFrom(request.headers),
      device: request.headers.get('user-agent'),
    })

    // Persist the signer's typed-name/consent/signature-image record via the
    // e-sign provider (Task 10), keyed off which party this user is.
    const signerRole: 'brand' | 'athlete' | 'agent' =
      contract.brand_id === user.id ? 'brand'
      : contract.agent_id === user.id ? 'agent'
      : 'athlete'
    const signedAt =
      signerRole === 'brand' ? contract.brand_signed_at
      : signerRole === 'agent' ? contract.agent_signed_at
      : contract.athlete_signed_at
    // signContract (above) always sets THIS signer's `*_signed_at` column in
    // the same call that returned `contract`, so signedAt is non-null here
    // even though the column itself is nullable (it's null until that party
    // signs) — hence the cast.
    //
    // Non-atomic edge: signContract commits `*_signed_at` first and this
    // recordSignature call is a separate write. If recordSignature throws,
    // the signature has already "taken" but the audit row is missing, and a
    // retry from the client would hit ALREADY_SIGNED with no way to write
    // the audit row after the fact.
    await provider().recordSignature(
      contractId, signerRole, user.id,
      { typedName, consentText: CONSENT_TEXT, signatureImageDataUrl: signatureImage,
        paymentDetails,
        ip: clientIpFrom(request.headers), device: request.headers.get('user-agent') },
      signedAt as string
    )

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
      // Finalize (PDF generation) and the fully-signed notifications are
      // independent failure domains: a finalize error must not also skip the
      // emails/in-app notices, so each gets its own try/catch.
      try {
        await provider().finalizeContract(contractId)
      } catch (finalizeErr) {
        console.error('[contracts/sign] finalize failed', finalizeErr)
      }

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
