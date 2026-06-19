import StatStrip from '@/components/layout/stat-strip'

export interface ProfileStatStripProps {
  followers: string | null
  engagement: string | null
  sport: string | null
  level: string | null
  className?: string
}

const DASH = '—'

/**
 * ProfileStatStrip — the four headline athlete metrics rendered through the
 * shared StatStrip (A10): Followers | Engagement | Sport | Level
 * (spec §10.2.2). Missing values render an em dash so a tile never reads blank.
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
        { label: 'Followers', value: followers ?? DASH },
        { label: 'Engagement', value: engagement ?? DASH },
        { label: 'Sport', value: sport ?? DASH },
        { label: 'Level', value: level ?? DASH },
      ]}
    />
  )
}
