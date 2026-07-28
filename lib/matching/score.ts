/**
 * Match scoring (spec Section 10).
 *
 * A pure, database-free function that scores how well an athlete and a brand
 * listing fit, 0-100, with human-readable reasons. Kept independent of Supabase
 * so it is trivially unit-testable and can be reused on either discovery side.
 *
 * Weights (sum to 100): sport 30, level 20, location 20, audience 15,
 * availability 15. A listing that leaves a field open (no sport/level/location
 * required) does not penalise anyone for it; it awards the full weight, because
 * "open to any" fits everyone.
 */

export interface MatchAthlete {
  primary_sport?: string | null
  secondary_sport?: string | null
  level?: string | null
  home_city?: string | null
  home_country?: string | null
  availability_status?: string | null
  social_accounts?: unknown
}

export interface MatchListing {
  sport_required?: string | null
  level_required?: string | null
  location?: string | null
  is_remote?: boolean | null
}

export interface MatchResult {
  score: number
  reasons: string[]
}

const W = { sport: 30, level: 20, location: 20, audience: 15, availability: 15 } as const

function norm(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

function maxFollowers(social: unknown): number {
  if (!social || typeof social !== 'object') return 0
  const rec = social as Record<string, unknown>
  let max = 0
  for (const key of ['instagram_followers', 'tiktok_followers', 'youtube_subscribers', 'twitter_followers']) {
    const raw = rec[key]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return max
}

export function scoreAthleteForListing(athlete: MatchAthlete, listing: MatchListing): MatchResult {
  const reasons: string[] = []
  let score = 0

  // Sport
  const required = norm(listing.sport_required)
  if (!required) {
    score += W.sport
  } else if (required === norm(athlete.primary_sport)) {
    score += W.sport
    reasons.push('Sport matches')
  } else if (required === norm(athlete.secondary_sport)) {
    score += Math.round(W.sport * 0.7)
    reasons.push('Secondary sport matches')
  }

  // Level
  const levelReq = norm(listing.level_required)
  if (!levelReq) {
    score += W.level
  } else if (levelReq === norm(athlete.level)) {
    score += W.level
    reasons.push('Level matches')
  }

  // Location
  if (listing.is_remote || !norm(listing.location)) {
    score += W.location
    if (listing.is_remote) reasons.push('Remote friendly')
  } else {
    const loc = norm(listing.location)
    if (loc === norm(athlete.home_city)) {
      score += W.location
      reasons.push('Same city')
    } else if (norm(athlete.home_country) && loc.includes(norm(athlete.home_country))) {
      score += Math.round(W.location * 0.5)
      reasons.push('Same country')
    }
  }

  // Audience (log-ish buckets)
  const followers = maxFollowers(athlete.social_accounts)
  if (followers >= 100_000) {
    score += W.audience
    reasons.push('Large audience')
  } else if (followers >= 10_000) {
    score += Math.round(W.audience * 0.7)
    reasons.push('Solid audience')
  } else if (followers >= 1_000) {
    score += Math.round(W.audience * 0.4)
  }

  // Availability
  if (athlete.availability_status === 'available_now') {
    score += W.availability
    reasons.push('Available now')
  } else if (athlete.availability_status === 'available_from') {
    score += Math.round(W.availability * 0.5)
  }

  return { score: Math.max(0, Math.min(100, score)), reasons }
}

/** The best score across a set of listings, e.g. to rank an athlete's feed. */
export function bestListingMatch(athlete: MatchAthlete, listings: MatchListing[]): number {
  return listings.reduce((best, l) => Math.max(best, scoreAthleteForListing(athlete, l).score), 0)
}

/** Sort listings by fit for an athlete, best first. Stable for equal scores. */
export function sortListingsByMatch<T extends MatchListing>(listings: T[], athlete: MatchAthlete): T[] {
  return listings
    .map((listing, index) => ({ listing, index, score: scoreAthleteForListing(athlete, listing).score }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.listing)
}
