import type { ListingSummary } from '@/lib/supabase/discovery'

export type Urgency =
  | { kind: 'closing'; days: number; label: string }
  | { kind: 'new'; label: string }
  | null

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 7

// Calculate whole UTC calendar days between two dates
function wholeUtcDaysBetween(from: Date, to: Date): number {
  const fromDate = new Date(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const toDate = new Date(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.floor((toDate.getTime() - fromDate.getTime()) / DAY_MS)
}

export function getUrgency(
  listing: Pick<ListingSummary, 'application_deadline' | 'created_at'>,
  now: Date = new Date()
): Urgency {
  if (listing.application_deadline) {
    const deadline = Date.parse(listing.application_deadline)
    if (!Number.isNaN(deadline)) {
      const deadlineDate = new Date(deadline)
      const days = Math.max(0, wholeUtcDaysBetween(now, deadlineDate))
      if (days <= WINDOW_DAYS) {
        return { kind: 'closing', days, label: days === 0 ? 'Closes today' : `Closes in ${days}d` }
      }
    }
  }
  const created = Date.parse(listing.created_at)
  if (!Number.isNaN(created) && wholeUtcDaysBetween(new Date(created), now) <= WINDOW_DAYS) {
    return { kind: 'new', label: 'New' }
  }
  return null
}
