import Link from 'next/link'

import StatStrip from '@/components/layout/stat-strip'
import { cn } from '@/lib/utils'

export interface ProfileStatStripProps {
  followers: string | null
  engagement: string | null
  sport: string | null
  level: string | null
  /**
   * Viewer is the athlete who owns this profile. When audience metrics are
   * missing the owner gets a single subtle helper linking into settings,
   * rather than a call-to-action jammed into every value slot.
   */
  isOwner?: boolean
  /** Where the "Connect socials" helper points (the settings profile section). */
  settingsHref?: string
  className?: string
}

const NOT_SET = 'Not set'

/**
 * ProfileStatStrip — the four headline athlete metrics rendered through the
 * shared StatStrip (A10): Followers | Engagement | Sport | Level
 * (spec §10.2.2).
 *
 * Audience metrics (followers/engagement) are athlete-supplied, so present
 * values carry a "Self-reported" caption. When absent, the value slot shows a
 * neutral placeholder dash (announced as "Not provided" to screen readers) —
 * never a link in the number slot. For the owner a single "Connect socials to
 * show reach" helper sits beneath the strip so the two identical prompts that
 * used to fill both value slots are de-duplicated (PROF3). Sport/Level keep the
 * plain "Not set" so a tile is never blank.
 */
export default function ProfileStatStrip({
  followers,
  engagement,
  sport,
  level,
  isOwner = false,
  settingsHref,
  className,
}: ProfileStatStripProps) {
  const audienceStat = (label: string, value: string | null) => {
    if (value) return { label, value, caption: 'Self-reported' }
    // Empty metric: a quiet placeholder, never the CTA in the value slot.
    return { label, value: '-', srValue: 'Not provided' }
  }

  const audienceMissing = !followers || !engagement
  const showHelper = isOwner && Boolean(settingsHref) && audienceMissing

  return (
    <div className={cn('space-y-3', className)}>
      <StatStrip
        stats={[
          audienceStat('Followers', followers),
          audienceStat('Engagement', engagement),
          { label: 'Sport', value: sport ?? NOT_SET },
          { label: 'Level', value: level ?? NOT_SET },
        ]}
      />
      {showHelper && settingsHref ? (
        <p className="text-small text-muted-foreground">
          <Link
            href={settingsHref}
            className="text-primary underline-offset-2 hover:underline"
          >
            Connect socials to show reach
          </Link>
        </p>
      ) : null}
    </div>
  )
}
