import { ImageIcon } from 'lucide-react'

import HeroPanel from '@/components/layout/hero-panel'
import { AvailabilityBadge, VerifiedBadge } from '@/components/ui/status-badges'
import { cn } from '@/lib/utils'

type AvailabilityStatus = 'available_now' | 'available_from' | 'not_available'

export interface ProfileHeroProps {
  /**
   * Full-bleed cover image; null renders a designed placeholder band. Must be
   * genuine wide cover art — never the square avatar (stretching the avatar
   * across the band was the misaligned-banner bug).
   */
  coverImage?: string | null
  /** Square profile photo, rendered as a circular avatar in the info panel. */
  avatar?: string | null
  name: string
  /** e.g. "Sprinter · National" */
  tagline?: string | undefined
  location?: string | undefined
  verified?: boolean | undefined
  availability?: { status: AvailabilityStatus; date?: string } | undefined
  /**
   * Persistent primary CTA rendered in the hero panel (e.g. a brand-facing
   * "Send connection request"). Only supplied for the non-owner view.
   */
  action?: React.ReactNode
  className?: string | undefined
}

/** "Jane Doe" -> "JD"; empty/odd input falls back to "?". */
function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
  return letters ? letters.toUpperCase() : '?'
}

/**
 * ProfileHero — composes the shared HeroPanel (A10) into the athlete public
 * profile header: full-bleed cover with a floating info panel carrying the
 * athlete's avatar, name, tagline, location and status badges (spec §10.2.2).
 * When no cover image exists a designed band stands in so the layout never
 * collapses: a soft brand-tinted gradient when an avatar carries the identity,
 * or the muted media placeholder when there is no imagery at all.
 *
 * PROF2 guard: a missing avatar never leaves a blank space — an initials disc
 * always carries the identity. The stored image itself is user data and is not
 * altered here; upload guidance/validation belongs in the settings upload flow.
 */
export default function ProfileHero({
  coverImage,
  avatar,
  name,
  tagline,
  location,
  verified,
  availability,
  action,
  className,
}: ProfileHeroProps) {
  const avatarNode = avatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/CDN URL, not a static asset
    <img
      src={avatar}
      alt={`${name} profile photo`}
      className="size-16 shrink-0 rounded-full border border-border bg-muted object-cover sm:size-20"
    />
  ) : (
    // PROF2: initials fallback so identity is always visually present.
    <div
      aria-hidden="true"
      className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-large font-semibold text-muted-foreground sm:size-20"
    >
      {initialsOf(name)}
    </div>
  )

  const panel = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 items-start gap-4 sm:gap-6">
        {avatarNode}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-large font-semibold text-foreground">{name}</h1>
            {/* PROF4: only the earned, positive "Verified" badge appears here.
                The grey "Unverified" pill was noise with no path to act, so it
                is no longer shown; the owner is offered a "Get verified" action
                elsewhere on the page instead. */}
            {verified ? <VerifiedBadge verified /> : null}
            {availability ? (
              <AvailabilityBadge
                status={availability.status}
                {...(availability.date ? { date: availability.date } : {})}
              />
            ) : null}
          </div>
          {tagline ? <p className="text-medium text-muted-foreground">{tagline}</p> : null}
          {location ? <p className="text-small text-muted-foreground">{location}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0 sm:self-center">{action}</div> : null}
    </div>
  )

  if (coverImage) {
    return (
      <HeroPanel
        image={coverImage}
        alt={`${name} cover`}
        {...(className ? { className } : {})}
      >
        {panel}
      </HeroPanel>
    )
  }

  // Designed placeholder for missing cover media — mirrors HeroPanel layout.
  // With an avatar present the band is purely decorative (the identity lives
  // in the panel), so it drops the media icon in favour of a quiet gradient.
  return (
    <section className={cn('relative', className)}>
      <div
        aria-label={`${name} cover placeholder`}
        className={cn(
          'flex h-48 w-full items-center justify-center text-muted-foreground sm:h-64 md:h-80',
          avatar
            ? 'bg-gradient-to-br from-primary/10 via-muted to-primary/5'
            : 'bg-muted',
        )}
      >
        {avatar ? null : <ImageIcon aria-hidden="true" className="size-10" />}
      </div>
      <div className="mx-auto -mt-12 max-w-7xl px-6 sm:-mt-16 md:px-16">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          {panel}
        </div>
      </div>
    </section>
  )
}
