import Link from 'next/link'
import { SeekingTag } from '@/components/ui/status-badges'
import { cn } from '@/lib/utils'

export interface ProfileSeekingProps {
  /** Raw seeking enum values, e.g. ["paid_partnership", "product_gifting"]. */
  seeking: string[]
  /**
   * athlete_profiles.is_seeking. Optional with a true default so call sites
   * that predate the column keep their current behaviour (the column itself
   * defaults to true).
   */
  isSeeking?: boolean
  /** Whether the viewer owns this profile; owners get links back to Settings. */
  isOwner?: boolean
  className?: string
}

/** "paid_partnership" -> "Paid partnership" */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function SettingsLink({ children }: { children: React.ReactNode }) {
  return (
    <Link
      href="/athlete/settings#visibility"
      className="text-small text-primary underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  )
}

/**
 * ProfileSeeking: a wrapping section of what the athlete is seeking, rendered
 * as accent SeekingTag pills (A5, spec §10.2.2).
 *
 * States:
 * - isSeeking false: "Not currently seeking opportunities." plus, for the
 *   owner, a link to the Settings discovery section to turn it back on.
 * - isSeeking true with no interests picked: neutral "Open to opportunities."
 *   plus, for the owner, a link to pick interests.
 * - otherwise: the interest pills.
 */
export default function ProfileSeeking({
  seeking,
  isSeeking = true,
  isOwner = false,
  className,
}: ProfileSeekingProps) {
  if (!isSeeking) {
    return (
      <div className={cn('space-y-1', className)}>
        <p className="text-medium text-muted-foreground">
          Not currently seeking opportunities.
        </p>
        {isOwner ? (
          <SettingsLink>Turn seeking back on in Settings</SettingsLink>
        ) : null}
      </div>
    )
  }

  if (seeking.length === 0) {
    return (
      <div className={cn('space-y-1', className)}>
        <p className="text-medium text-muted-foreground">Open to opportunities.</p>
        {isOwner ? (
          <SettingsLink>Pick what you&apos;re seeking in Settings</SettingsLink>
        ) : null}
      </div>
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
