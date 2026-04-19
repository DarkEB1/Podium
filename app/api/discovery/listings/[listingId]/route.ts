import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListing, updateListing, DiscoveryError } from '@/lib/supabase/discovery'

export async function GET(
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

  const { listingId } = await params
  const listing = await getListing(supabase, listingId)

  if (!listing) {
    return NextResponse.json(
      { error: { code: 'LISTING_NOT_FOUND', message: 'Listing not found' } },
      { status: 404 }
    )
  }

  return NextResponse.json(listing)
}

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

  const brandProfile = await getOwnProfile(supabase, user.id, 'brand')

  if (!brandProfile) {
    return NextResponse.json(
      { error: { code: 'BRAND_PROFILE_NOT_FOUND', message: 'Brand profile not found' } },
      { status: 404 }
    )
  }

  const { listingId } = await params
  const body = (await request.json()) as Record<string, unknown>

  try {
    const listing = await updateListing(supabase, listingId, brandProfile.id, body)
    return NextResponse.json(listing)
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
