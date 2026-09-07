import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/server'
import { getContractByEsignEnvelopeId, terminateContract } from '@/lib/supabase/contracts'
import { provider } from '@/lib/esign'

// This is the seam a future EXTERNAL e-signature provider would call back on.
// The in-house provider (lib/esign/podium.ts) finalizes synchronously inside
// the sign route and never hits this endpoint — so it is built and tested,
// but dormant, until an external provider is wired up. Never parse the body
// before verifying its signature.
export const dynamic = 'force-dynamic'

/**
 * Verifies the raw body against `x-esign-signature` (hex HMAC-SHA256).
 * `timingSafeEqual` throws on mismatched buffer lengths (e.g. malformed hex
 * from an attacker), so the length check must happen first — never let a
 * throw from a bad signature turn into an unhandled 500 that could leak
 * timing information about validation stages.
 */
function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  let expectedBuf: Buffer
  let providedBuf: Buffer
  try {
    expectedBuf = Buffer.from(expected, 'hex')
    providedBuf = Buffer.from(signature, 'hex')
  } catch {
    return false
  }
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

interface EsignWebhookPayload {
  event?: string
  envelopeId?: string
  reason?: string
}

export async function POST(request: NextRequest) {
  // Fail CLOSED: the in-house provider never sets this secret (it has no
  // external webhook), so an unset secret here means the seam is dormant —
  // never silently accept an unverified event.
  const secret = serverEnv().ESIGN_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'esign webhook is not configured in this environment' } },
      { status: 500 }
    )
  }

  // Raw body, read once, verified BEFORE any parsing or processing.
  const rawBody = await request.text()
  if (!verifySignature(rawBody, request.headers.get('x-esign-signature'), secret)) {
    return NextResponse.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'esign webhook signature verification failed' } },
      { status: 400 }
    )
  }

  let payload: EsignWebhookPayload
  try {
    payload = JSON.parse(rawBody) as EsignWebhookPayload
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'esign webhook body is not valid JSON' } },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const contract = await getContractByEsignEnvelopeId(admin, payload.envelopeId ?? '')

  if (!contract) {
    // Unknown envelope — ack so the provider stops retrying a delivery this
    // app can never resolve to a contract.
    return NextResponse.json({ received: true, unknown: true }, { status: 200 })
  }

  if (payload.event === 'completed') {
    // Idempotent: finalizeContract is a no-op once document_url is set.
    await provider().finalizeContract(contract.id)
  } else if (payload.event === 'declined' || payload.event === 'voided') {
    await terminateContract(admin, contract.id, payload.reason ?? payload.event)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
