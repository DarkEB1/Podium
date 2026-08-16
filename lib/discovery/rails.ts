// Groups scored discovery listings into the made-for-you rails shown on the
// discovery feed. Pure: no data fetching, everything comes in via arguments.

import type { ScoredListing } from '@/lib/discovery/match'
import { getUrgency } from '@/lib/discovery/urgency'

export type Rail = {
  id: string
  title: string
  subtitle?: string
  listings: ScoredListing[]
}

const RAIL_CAP = 12

function byMatchScoreDesc(a: ScoredListing, b: ScoredListing): number {
  return b.matchScore - a.matchScore
}

export function buildRails(
  scored: ScoredListing[],
  opts: { athleteSport?: string | null; now?: Date }
): Rail[] {
  if (scored.length === 0) return []

  const now = opts.now ?? new Date()
  const rails: Rail[] = []

  if (opts.athleteSport) {
    const sport = opts.athleteSport
    const onSport = scored
      .filter((listing) => listing.sport_required?.toLowerCase() === sport.toLowerCase())
      .sort(byMatchScoreDesc)
      .slice(0, RAIL_CAP)
    if (onSport.length > 0) {
      rails.push({
        id: `because-you-${sport.toLowerCase()}`,
        title: `Because you ${sport.toLowerCase()}`,
        listings: onSport,
      })
    }
  }

  const newThisWeek = scored
    .filter((listing) => getUrgency(listing, now)?.kind === 'new')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, RAIL_CAP)
  if (newThisWeek.length > 0) {
    rails.push({ id: 'new-this-week', title: 'New this week', listings: newThisWeek })
  }

  const closingSoon = scored
    .map((listing) => ({ listing, urgency: getUrgency(listing, now) }))
    .filter(
      (entry): entry is { listing: ScoredListing; urgency: { kind: 'closing'; days: number; label: string } } =>
        entry.urgency?.kind === 'closing'
    )
    .sort((a, b) => a.urgency.days - b.urgency.days)
    .slice(0, RAIL_CAP)
    .map((entry) => entry.listing)
  if (closingSoon.length > 0) {
    rails.push({ id: 'closing-soon', title: 'Closing soon', listings: closingSoon })
  }

  const topMatches = [...scored].sort(byMatchScoreDesc).slice(0, RAIL_CAP)
  rails.push({ id: 'top-matches', title: 'Top matches', listings: topMatches })

  return rails
}
