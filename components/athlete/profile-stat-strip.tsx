import StatStrip from '@/components/layout/stat-strip'

export interface ProfileStatStripProps {
  followers: string | null
  engagement: string | null
  sport: string | null
  level: string | null
  /**
   * Viewer is the athlete who owns this profile. Missing audience metrics
   * become an actionable "Add socials" link instead of a dead placeholder.
   */
  isOwner?: boolean
  /** Where "Add socials" points (the athlete settings profile section). */
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
 * values carry a "Self-reported" caption. When absent, the owner sees an
 * "Add socials" link into settings; other viewers see a visual dash that
 * still announces "Not provided" to screen readers. Sport/Level keep the
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
    if (isOwner && settingsHref) {
      return { label, value: 'Add socials', href: settingsHref }
    }
    return { label, value: '-', srValue: 'Not provided' }
  }

  return (
    <StatStrip
      {...(className ? { className } : {})}
      stats={[
        audienceStat('Followers', followers),
        audienceStat('Engagement', engagement),
        { label: 'Sport', value: sport ?? NOT_SET },
        { label: 'Level', value: level ?? NOT_SET },
      ]}
    />
  )
}
