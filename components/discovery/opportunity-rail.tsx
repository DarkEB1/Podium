import type { Rail } from '@/lib/discovery/rails'

import { OpportunityCard } from './opportunity-card'

interface Props {
  rail: Rail
  index: number
}

/**
 * OpportunityRail is a horizontally scrollable row of OpportunityCards under
 * a header carrying the rail's position, a live pulse dot, the title with a
 * lime underline accent, and the listing count (Task 8).
 *
 * The scroll row uses overscroll-behavior-x: contain so an athlete dragging
 * through cards never traps the page's vertical scroll, and is exposed as a
 * labelled region so screen reader users can jump straight to a named rail.
 */
export function OpportunityRail({ rail, index }: Props) {
  const label = String(index + 1).padStart(2, '0')

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-small font-medium tracking-[0.06em] text-muted-foreground">
            {label}
          </span>
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-lime motion-safe:animate-pulse"
          />
          <div>
            <h2 className="relative inline-block pb-1.5 text-medium font-bold tracking-tight text-foreground">
              {rail.title}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[3px] w-9 rounded-full bg-lime"
              />
            </h2>
            {rail.subtitle ? (
              <p className="text-small text-muted-foreground">{rail.subtitle}</p>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 font-mono text-small text-muted-foreground">
          {rail.listings.length} in rail
        </span>
      </div>

      <div
        role="region"
        aria-label={rail.title}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2"
      >
        {rail.listings.map((listing) => (
          <div key={listing.id} className="w-[280px] shrink-0 snap-start">
            <OpportunityCard listing={listing} />
          </div>
        ))}
      </div>
    </section>
  )
}
