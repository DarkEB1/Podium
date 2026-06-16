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
      <div className="mx-auto -mt-12 max-w-7xl px-4 sm:-mt-16">
        <div className="rounded-[var(--radius)] border bg-card p-4 shadow-[var(--shadow-card)] sm:p-8">
          {children}
        </div>
      </div>
    </section>
  )
}
