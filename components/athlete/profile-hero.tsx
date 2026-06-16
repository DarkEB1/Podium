import { ImageIcon } from 'lucide-react'

import HeroPanel from '@/components/layout/hero-panel'
import { AvailabilityBadge, VerifiedBadge } from '@/components/ui/status-badges'
import { cn } from '@/lib/utils'

type AvailabilityStatus = 'available_now' | 'available_from' | 'not_available'

export interface ProfileHeroProps {
  /** Full-bleed cover image; null renders a designed placeholder band. */
  coverImage: string | null
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
 * athlete's name, tagline, location and status badges (spec §10.2.2). When no
 * cover image exists a designed muted band stands in so the layout never
 * collapses (designed empty state).
 */
export default function ProfileHero({
  coverImage,
  name,
  tagline,
  location,
  verified,
  availability,
  className,
}: ProfileHeroProps) {
  const panel = (
    <div className="flex flex-col gap-2">
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
  return (
    <section className={cn('relative', className)}>
      <div
        aria-label={`${name} cover placeholder`}
        className="flex h-48 w-full items-center justify-center bg-muted text-muted-foreground sm:h-64 md:h-80"
      >
        <ImageIcon aria-hidden="true" className="size-10" />
      </div>
      <div className="mx-auto -mt-12 max-w-7xl px-4 sm:-mt-16">
        <div className="rounded-[var(--radius)] border bg-card p-4 shadow-[var(--shadow-card)] sm:p-8">
          {panel}
        </div>
      </div>
    </section>
  )
}
