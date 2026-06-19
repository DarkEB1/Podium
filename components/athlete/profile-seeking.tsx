import { SeekingTag } from '@/components/ui/status-badges'
import { cn } from '@/lib/utils'

export interface ProfileSeekingProps {
  /** Raw seeking enum values, e.g. ["paid_partnership", "product_gifting"]. */
  seeking: string[]
  className?: string
}

/** "paid_partnership" -> "Paid partnership" */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * ProfileSeeking — a wrapping section of what the athlete is seeking, rendered
 * as accent SeekingTag pills (A5, spec §10.2.2). Shows a quiet line when the
 * athlete is not seeking anything right now.
 */
export default function ProfileSeeking({ seeking, className }: ProfileSeekingProps) {
  if (seeking.length === 0) {
    return (
      <p className={cn('text-medium text-muted-foreground', className)}>
        Not currently seeking opportunities.
      </p>
    )
  }

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {seeking.map((value) => (
        <li key={value}>
          <SeekingTag>{humanise(value)}</SeekingTag>
        </li>
      ))}
    </ul>
  )
}
