import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListing, updateListingStatus, isListingActivation } from '@/lib/supabase/discovery'
import { assertCanCreateListing } from '@/lib/supabase/entitlements'
import { listingErrorResponse, listingEntitlementResponse, readJsonBody } from '@/lib/api/errors'
import { Constants, type Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type ListingStatus = Database['public']['Enums']['listing_status']

const VALID_STATUSES = new Set<string>(Constants.public.Enums.listing_status)

/**
 * WS-LISTING-02: Pause / Resume / Close.
 *
 * The brand listings manager used to PATCH `{ status }` to the generic listing
 * update route, where `status` is a protected field that is stripped — so the
 * update ran `.update({})`, changed nothing, and still toasted success. This
 * dedicated route drives `updateListingStatus`, which validates the transition
 * against the real stored status.
 *
 * Resuming (or otherwise bringing a listing back to `active`) re-consumes a
 * tier slot, so it is gated by the same entitlement check as create/publish
 * (WS-LISTING-04) — pausing to free a slot then resuming cannot exceed the cap.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (user.role !== 'brand') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only brands can update listings' } },
      { status: 403 }
    )
  }

  const brandProfile = (await getOwnProfile(supabase, user.id, 'brand')) as BrandRow | null

  if (!brandProfile) {
    return NextResponse.json(
      { error: { code: 'BRAND_PROFILE_NOT_FOUND', message: 'Brand profile not found' } },
      { status: 404 }
    )
  }

  const { listingId } = await params
  const parsed = await readJsonBody(request)
  if ('response' in parsed) return parsed.response

  const nextStatus = parsed.body.status
  if (typeof nextStatus !== 'string' || !VALID_STATUSES.has(nextStatus)) {
    return NextResponse.json(
      { error: { code: 'INVALID_STATUS', message: 'A valid listing status is required.' } },
      { status: 400 }
    )
  }

  // Gate any activation exactly like create/publish. The current status is read
  // once here so we only run the (subscription-querying) gate when the move is
  // actually an activation; updateListingStatus re-reads and re-validates the
  // transition atomically against the owned row.
  if (nextStatus === 'active') {
    const current = await getListing(supabase, listingId)
    if (current && current.brand_id === brandProfile.id && isListingActivation(current.status, 'active')) {
      const gate = await assertCanCreateListing(supabase, user.id, user.role)
      if (!gate.allowed) return listingEntitlementResponse(gate)
    }
  }

  try {
    const listing = await updateListingStatus(
      supabase,
      listingId,
      brandProfile.id,
      nextStatus as ListingStatus
    )
    return NextResponse.json(listing)
  } catch (err) {
    const response = listingErrorResponse(err)
    if (response) return response
    throw err
  }
}
