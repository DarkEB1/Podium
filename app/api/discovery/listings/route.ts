import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { createListing, getListings } from '@/lib/supabase/discovery'

export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const listings = await getListings(supabase)
  return NextResponse.json(listings)
}

export async function POST(request: NextRequest) {
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
      { error: { code: 'FORBIDDEN', message: 'Only brands can create listings' } },
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

  const body = (await request.json()) as Record<string, unknown>
  const listing = await createListing(supabase, brandProfile.id, body)
  return NextResponse.json(listing, { status: 201 })
}
