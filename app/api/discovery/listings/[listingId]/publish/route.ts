import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { publishListing, DiscoveryError } from '@/lib/supabase/discovery'

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

  const brandProfile = await getOwnProfile(supabase, user.id, 'brand')

  if (!brandProfile) {
    return NextResponse.json(
      { error: { code: 'BRAND_PROFILE_NOT_FOUND', message: 'Brand profile not found' } },
      { status: 404 }
    )
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
