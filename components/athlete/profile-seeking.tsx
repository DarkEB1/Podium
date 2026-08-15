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
  /** Athlete display name, used in the "What <name> is looking for" intro. */
  name?: string
  className?: string
}

/**
 * Canonical label + one-line plain-English description per seeking category
 * (PROF10). The enum values ("university_nil_collective") are jargon on their
 * own; the description explains each offering to a brand on hover, and the
 * labels mirror the shared marketplace copy in athlete-profile-detail.tsx.
 */
const SEEKING_META: Record<string, { label: string; description: string }> = {
  product_gifting: {
    label: 'Product gifting',
    description: 'Free products in exchange for exposure, with no fee.',
  },
  paid_partnership: {
    label: 'Paid partnership',
    description: 'A paid collaboration or sponsored campaign.',
  },
  brand_ambassador: {
    label: 'Brand ambassador',
    description: 'An ongoing role representing a brand over time.',
  },
  social_content: {
    label: 'Social content',
    description: 'Creating posts, reels or stories for a brand.',
  },
  event_appearance: {
    label: 'Event appearance',
    description: 'Appearing at launches, activations or meet-ups.',
  },
  affiliate_code: {
    label: 'Affiliate / discount code',
    description: 'Earning commission on sales from a personal code.',
  },
  equipment_sponsorship: {
    label: 'Equipment sponsorship',
    description: 'Supplied kit or gear to train and compete with.',
  },
  nutrition_supplement: {
    label: 'Nutrition & supplements',
    description: 'Food, drink or supplement partnerships.',
  },
  apparel_deal: {
    label: 'Apparel deal',
    description: 'Clothing or footwear supply and promotion.',
  },
  university_nil_collective: {
    label: 'University / NIL collective',
    description: 'Name, image and likeness deals through a college collective.',
  },
}

/** "paid_partnership" -> "Paid partnership" (fallback for unmapped values). */
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
 * PROF10: an intro line ("What <name> is looking for") frames the pills, each
 * pill carries a plain-English description as a native tooltip, and unmapped
 * enum values still humanise gracefully.
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
  name,
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

  const subject = name?.trim() || 'this athlete'

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-small text-muted-foreground">
        What {subject} is looking for
      </p>
      <ul className="flex flex-wrap gap-2">
        {seeking.map((value) => {
          const meta = SEEKING_META[value]
          const label = meta?.label ?? humanise(value)
          return (
            <li key={value} {...(meta?.description ? { title: meta.description } : {})}>
              <SeekingTag>{label}</SeekingTag>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
