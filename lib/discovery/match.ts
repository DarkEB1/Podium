// The scoring engine (lib/matching/score.ts) is interim and will be replaced by MeritRank.
// This helper is the single seam every consumer reads the score through, so a future
// swap touches only this file.

import { scoreAthleteForListing, type MatchAthlete } from '@/lib/matching/score'
import type { ListingSummary } from '@/lib/supabase/discovery'

export type ScoredListing = ListingSummary & {
  matchScore: number
  matchReasons: string[]
}

export function decorateWithMatch(
  listings: ListingSummary[],
  athlete: MatchAthlete | null
): ScoredListing[] {
  return listings.map((listing) => {
    if (!athlete) return { ...listing, matchScore: 0, matchReasons: [] }
    const { score, reasons } = scoreAthleteForListing(athlete, listing)
    return { ...listing, matchScore: score, matchReasons: reasons }
  })
}
