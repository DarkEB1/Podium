import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListing, updateListing } from '@/lib/supabase/discovery'
import { listingErrorResponse, readJsonBody } from '@/lib/api/errors'

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
  const parsed = await readJsonBody(request)
  if ('response' in parsed) return parsed.response

  try {
    const listing = await updateListing(supabase, listingId, brandProfile.id, parsed.body)
    return NextResponse.json(listing)
  } catch (err) {
    // Every rejected update used to be re-thrown as a bodyless 500 except
    // LISTING_NOT_FOUND, so `res.json()` threw in the browser before it could
    // read the error. Shared with POST so the two cannot drift apart.
    const response = listingErrorResponse(err)
    if (response) return response
    throw err
  }
}
