import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getContractDocumentInfo } from '@/lib/supabase/contracts'
import { createSignedDownloadUrl, STORAGE_BUCKETS } from '@/lib/storage'
import { provider } from '@/lib/esign'

/**
 * Task 16 — participant-only "View / Download PDF" for a contract.
 *
 * RLS on `contracts` (the user's client, not admin) is what actually enforces
 * "participant or admin only": the select below returns a row solely when the
 * caller is allowed to see it, so a 404 here can mean either "no such
 * contract" or "not yours" — deliberately indistinguishable, same as every
 * other RLS-gated lookup in this codebase.
 *
 * Lazy re-finalize: `finalizeContractDocument` can fail after both parties
 * have signed (e.g. a transient storage error), leaving `document_url` null
 * on an otherwise `fully_signed` contract with no way to recover except a
 * manual re-run. Rather than leave the signer stuck, a fully-signed contract
 * with no document is retried here, on demand, via the idempotent
 * `provider().finalizeContract`.
 */
export async function GET(
  _request: NextRequest,
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

  const notFound = () =>
    NextResponse.json(
      { error: { code: 'DOCUMENT_NOT_FOUND', message: 'No signed document available.' } },
      { status: 404 }
    )

  // RLS: this select returns a row only if the user is a participant/admin.
  const contract = await getContractDocumentInfo(supabase, contractId)
  if (!contract) {
    return notFound()
  }

  let documentUrl = contract.document_url
  if (!documentUrl) {
    if (contract.status !== 'fully_signed') {
      return notFound()
    }

    // Idempotent + creates its own admin client — safe to call speculatively.
    await provider().finalizeContract(contractId)

    const refetched = await getContractDocumentInfo(supabase, contractId)
    if (!refetched || !refetched.document_url) {
      return notFound()
    }
    documentUrl = refetched.document_url
  }

  const url = await createSignedDownloadUrl(supabase, STORAGE_BUCKETS.docs, documentUrl)
  return NextResponse.redirect(url, 302)
}
