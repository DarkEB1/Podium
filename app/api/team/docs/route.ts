import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { createSignedDownloadUrl, StorageError } from '@/lib/storage'

/**
 * WS-PROFILE-01 / PM-11 — read path for private team documents.
 *
 * The `docs` bucket (team media packs and sponsorship briefs) is private: its
 * objects have no public URL, so `team_profiles.media_pack_url` /
 * `sponsorship_brief_url` were effectively write-only — nothing could open them.
 * This route mints a short-lived signed download URL for a `docs` object.
 *
 * Authorization is enforced by the storage RLS SELECT policy
 * (`podium_storage_objects_select_docs`, migration 20260720005002): the signed
 * URL is only issued when the caller owns the `<uid>/` folder or shares an
 * ACTIVE match with its owner (or is an admin). We do not re-check here — the
 * database is the boundary — but a failed sign becomes a 403.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
      { status: 401 }
    )
  }

  const path = request.nextUrl.searchParams.get('path')?.trim()
  if (!path) {
    return NextResponse.json(
      { error: { code: 'MISSING_PATH', message: 'A docs object path is required' } },
      { status: 400 }
    )
  }

  try {
    const url = await createSignedDownloadUrl(supabase, 'docs', path)
    return NextResponse.json({ url })
  } catch (err) {
    if (err instanceof StorageError) {
      // Not authorised for the object, or it does not exist — either way the
      // caller may not read it. Do not distinguish (avoid confirming existence).
      return NextResponse.json(
        { error: { code: 'DOC_NOT_ACCESSIBLE', message: 'Document not available' } },
        { status: 403 }
      )
    }
    throw err
  }
}
