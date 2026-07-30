import StatStrip from '@/components/layout/stat-strip'

export interface ProfileStatStripProps {
  followers: string | null
  engagement: string | null
  sport: string | null
  level: string | null
  className?: string
}

const NOT_SET = 'Not set'

/**
 * ProfileStatStrip — the four headline athlete metrics rendered through the
 * shared StatStrip (A10): Followers | Engagement | Sport | Level
 * (spec §10.2.2). Missing values read "Not set" so a tile is never blank and a
 * screen reader announces something meaningful.
 */
export default function ProfileStatStrip({
  followers,
  engagement,
  sport,
  level,
  className,
}: ProfileStatStripProps) {
  return (
    <StatStrip
      {...(className ? { className } : {})}
      stats={[
        { label: 'Followers', value: followers ?? NOT_SET },
        { label: 'Engagement', value: engagement ?? NOT_SET },
        { label: 'Sport', value: sport ?? NOT_SET },
        { label: 'Level', value: level ?? NOT_SET },
      ]}
    />
  )
}
