import type { ListingSummary } from '@/lib/supabase/discovery'

export type Urgency =
  | { kind: 'closing'; days: number; label: string }
  | { kind: 'new'; label: string }
  | null

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 7

export function getUrgency(
  listing: Pick<ListingSummary, 'application_deadline' | 'created_at'>,
  now: Date = new Date()
): Urgency {
  if (listing.application_deadline) {
    const deadline = Date.parse(listing.application_deadline)
    if (!Number.isNaN(deadline)) {
      const deadlineDate = new Date(deadline)
      // Calendar day difference: extract dates at midnight UTC
      const nowDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      const deadlineDateOnly = new Date(deadlineDate.getUTCFullYear(), deadlineDate.getUTCMonth(), deadlineDate.getUTCDate())
      const days = Math.max(0, Math.floor((deadlineDateOnly.getTime() - nowDate.getTime()) / DAY_MS))
      if (days <= WINDOW_DAYS) {
        return { kind: 'closing', days, label: days === 0 ? 'Closes today' : `Closes in ${days}d` }
      }
    }
  }
  const created = Date.parse(listing.created_at)
  if (!Number.isNaN(created) && now.getTime() - created <= WINDOW_DAYS * DAY_MS) {
    return { kind: 'new', label: 'New' }
  }
  return null
}
