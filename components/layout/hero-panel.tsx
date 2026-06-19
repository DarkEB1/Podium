import { cn } from '@/lib/utils'

interface HeroPanelProps {
  image: string
  alt: string
  children: React.ReactNode
  className?: string
}

/**
 * HeroPanel — full-bleed cover image with a floating info panel overlapping
 * its lower edge (spec §10.2.2). Used at the top of profile/detail pages.
 *
 * Clean Airbnb: the floating panel uses a generous rounded-2xl radius, a single
 * light border and a soft card shadow (--shadow-card is now soft) — no ink
 * border or hard offset shadow.
 */
export default function HeroPanel({ image, alt, children, className }: HeroPanelProps) {
  return (
    <section className={cn('relative', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- cover may be an arbitrary remote/presigned URL not in next.config domains */}
      <img
        src={image}
        alt={alt}
        className="h-48 w-full object-cover sm:h-64 md:h-80"
      />
      <div className="mx-auto -mt-12 max-w-7xl px-6 sm:-mt-16 md:px-16">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          {children}
        </div>
      </div>
    </section>
  )
}
