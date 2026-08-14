import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { createListing, getListings } from '@/lib/supabase/discovery'
import { assertCanCreateListing } from '@/lib/supabase/entitlements'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import { listingErrorResponse, readJsonBody } from '@/lib/api/errors'

export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  try {
    const listings = await getListings(supabase)
    return NextResponse.json(listings)
  } catch (err) {
    const response = listingErrorResponse(err)
    if (response) return response
    throw err
  }
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

  // DH-2: listings are public artefacts — limited per user in its own key
  // namespace so listing spam cannot also consume the messaging budget.
  const limited = await consume(userKey('listing_create', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

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

  // Entitlement gate: gated brands are capped on active listings per their
  // subscription tier (see lib/supabase/entitlements.ts).
  const gate = await assertCanCreateListing(supabase, user.id, user.role)
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: {
          code: gate.reason === 'NO_SUBSCRIPTION' ? 'SUBSCRIPTION_REQUIRED' : 'LIMIT_REACHED',
          message:
            gate.reason === 'NO_SUBSCRIPTION'
              ? 'An active subscription is required to create listings.'
              : `Your plan allows ${gate.limit} active listings. Pause or upgrade to add more.`,
        },
        limit: gate.limit,
        used: gate.used,
        tier: gate.tier,
      },
      { status: 402 }
    )
  }

  const parsed = await readJsonBody(request)
  if ('response' in parsed) return parsed.response

  try {
    const listing = await createListing(supabase, brandProfile.id, parsed.body)
    return NextResponse.json(listing, { status: 201 })
  } catch (err) {
    const response = listingErrorResponse(err)
    if (response) return response
    throw err
  }
}
