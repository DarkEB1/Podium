import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * CardSkeleton — placeholder that mirrors MarketplaceCard's proportions so the
 * grid reserves the same footprint while data loads, preventing layout shift.
 * The image block uses aspect-[3/5] (= 0.6, MarketplaceCard's default imageRatio).
 *
 * Clean Airbnb silhouette: a softly rounded (rounded-2xl) surface with a single
 * light border and no shadow while loading. The frame stays calm and flat — it
 * reads as reserved space rather than a settled, interactive card, so we keep
 * elevation off until real data lands.
 */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="card-skeleton"
      role="status"
      aria-busy="true"
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        // Reduced-motion: the pulse is a movement-based loading cue; freeze it for
        // users who opt out. Scoped to skeletons inside this card so the shared
        // Skeleton primitive's API is untouched.
        "[&_[data-slot=skeleton]]:motion-reduce:animate-none",
        className
      )}
    >
      <Skeleton
        data-slot="card-skeleton-image"
        className="aspect-[3/5] w-full rounded-none"
      />
      <div className="flex flex-col gap-3 p-5">
        {/* title */}
        <Skeleton className="h-6 w-3/4 rounded-lg" />
        {/* subtitle */}
        <Skeleton className="h-4 w-1/2 rounded-lg" />
        {/* stat row */}
        <Skeleton className="mt-1 h-4 w-2/5 rounded-lg" />
        {/* cta */}
        <Skeleton className="mt-3 h-9 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export { CardSkeleton }
