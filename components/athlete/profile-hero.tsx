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
  className?: string | undefined
}

/**
 * ProfileHero — composes the shared HeroPanel (A10) into the athlete public
 * profile header: full-bleed cover with a floating info panel carrying the
 * athlete's avatar, name, tagline, location and status badges (spec §10.2.2).
 * When no cover image exists a designed band stands in so the layout never
 * collapses: a soft brand-tinted gradient when an avatar carries the identity,
 * or the muted media placeholder when there is no imagery at all.
 */
export default function ProfileHero({
  coverImage,
  avatar,
  name,
  tagline,
  location,
  verified,
  availability,
  className,
}: ProfileHeroProps) {
  const panel = (
    <div className="flex items-start gap-4 sm:gap-6">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/CDN URL, not a static asset
        <img
          src={avatar}
          alt={`${name} profile photo`}
          className="size-16 shrink-0 rounded-full border border-border bg-muted object-cover sm:size-20"
        />
      ) : null}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-large font-semibold text-foreground">{name}</h1>
          {verified !== undefined ? <VerifiedBadge verified={verified} /> : null}
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
