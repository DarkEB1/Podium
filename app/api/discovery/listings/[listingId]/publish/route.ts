import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { publishListing, DiscoveryError } from '@/lib/supabase/discovery'
import { assertCanCreateListing } from '@/lib/supabase/entitlements'
import { listingEntitlementResponse } from '@/lib/api/errors'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

export async function POST(
  _request: NextRequest,
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
      { error: { code: 'FORBIDDEN', message: 'Only brands can publish listings' } },
      { status: 403 }
    )
  }

  // getOwnProfile returns the role union; role 'brand' narrows it to BrandRow.
  const brandProfile = (await getOwnProfile(supabase, user.id, 'brand')) as BrandRow | null

  if (!brandProfile) {
    return NextResponse.json(
      { error: { code: 'BRAND_PROFILE_NOT_FOUND', message: 'Brand profile not found' } },
      { status: 404 }
    )
  }

  // PM-22: a brand that is still pending approval, suspended or rejected must
  // not be able to put a listing live. Draft creation is unaffected — only the
  // publish step, which is what makes a listing publicly discoverable, is gated.
  if (brandProfile.status !== 'active') {
    return NextResponse.json(
      {
        error: {
          code: 'BRAND_NOT_APPROVED',
          message:
            'Your brand is not approved to publish listings yet. Listings can be published once your account is approved.',
        },
      },
      { status: 403 }
    )
  }

  // WS-LISTING-04: the tier entitlement was enforced only on create, so a
  // Starter brand could hold unlimited drafts and publish them all past its
  // active-listing cap. Publishing brings the listing to `active`, so gate it
  // exactly like create.
  const gate = await assertCanCreateListing(supabase, user.id, user.role)
  if (!gate.allowed) {
    return listingEntitlementResponse(gate)
  }

  const { listingId } = await params

  try {
    await publishListing(supabase, listingId, brandProfile.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof DiscoveryError && err.code === 'LISTING_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'LISTING_NOT_FOUND', message: 'Listing not found or not owned by this brand' } },
        { status: 404 }
      )
    }
    throw err
  }
}
