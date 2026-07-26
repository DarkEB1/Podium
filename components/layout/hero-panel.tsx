import Image from 'next/image'

import { cn } from '@/lib/utils'
import { isRemoteImageSrc } from '@/components/ui/image-src'
import { solidBlurDataURL } from '@/lib/perf/blur-placeholder'

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
      {/*
        A-2: the wrapper owns the height, so the page reserves the cover's exact
        footprint before the bytes land (no CLS) and `fill` inherits it. The
        cover is above the fold on every profile page, hence `priority`.
      */}
      <div className="relative h-48 w-full overflow-hidden bg-muted sm:h-64 md:h-80">
        <Image
          src={image}
          alt={alt}
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          blurDataURL={solidBlurDataURL()}
          unoptimized={isRemoteImageSrc(image)}
          className="object-cover"
        />
      </div>
      <div className="mx-auto -mt-12 max-w-7xl px-6 sm:-mt-16 md:px-16">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          {children}
        </div>
      </div>
    </section>
  )
}
