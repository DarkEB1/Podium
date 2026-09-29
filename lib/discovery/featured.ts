// Athlete-visible Unlimited-plan perks on the discovery feed: the Verified
// brand badge and "Featured to athletes in your area". Pure: the caller passes
// the set of premium brand user ids (lib/supabase/premium-brands.ts).

import type { ScoredListing } from '@/lib/discovery/match'

export interface AreaProfile {
  home_city?: string | null
  home_country?: string | null
}

function norm(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

/**
 * Whether a listing is "in the athlete's area": its location names the
 * athlete's home city, or (as a coarser fallback) their home country. Remote
 * or location-less listings are not "in your area" for anyone, so they carry
 * the badge but are never featured.
 */
export function isListingInArea(
  listing: { location: string | null; is_remote: boolean | null },
  athlete: AreaProfile | null
): boolean {
  if (!athlete) return false
  const loc = norm(listing.location)
  if (!loc || listing.is_remote) return false
  const city = norm(athlete.home_city)
  const country = norm(athlete.home_country)
  if (city && (loc === city || loc.includes(city))) return true
  if (country && (loc === country || loc.includes(country))) return true
  return false
}

/** Stamp brandVerified + featured on each scored listing. */
export function decorateWithPremium<T extends ScoredListing>(
  listings: T[],
  premiumBrandUserIds: Set<string>,
  athlete: AreaProfile | null
): T[] {
  return listings.map((listing) => {
    const premium = listing.brand_user_id !== null && premiumBrandUserIds.has(listing.brand_user_id)
    return {
      ...listing,
      brandVerified: premium,
      featured: premium && isListingInArea(listing, athlete),
    }
  })
}
