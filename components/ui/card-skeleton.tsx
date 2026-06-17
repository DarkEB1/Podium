import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * CardSkeleton — placeholder that mirrors MarketplaceCard's proportions so the
 * grid reserves the same footprint while data loads, preventing layout shift.
 * The image block uses aspect-[3/5] (= 0.6, MarketplaceCard's default imageRatio).
 *
 * Neo-brutalist silhouette (plan §6/§1.1): the ink border at --border-ink-width
 * draws the same bordered box as the settled card, but the hard-offset
 * --shadow-card is intentionally omitted while loading — the surface hasn't
 * "landed" yet, so it reads as a reserved frame rather than an interactive card.
 */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="card-skeleton"
      role="status"
      aria-busy="true"
      className={cn(
        "overflow-hidden rounded-[--radius] border-[length:--border-ink-width] border-border-ink bg-card",
        // Reduced-motion (plan §0.4): the pulse is a movement-based loading cue;
        // freeze it for users who opt out. Scoped to skeletons inside this card
        // so the shared Skeleton primitive's API is untouched.
        "[&_[data-slot=skeleton]]:motion-reduce:animate-none",
        className
      )}
    >
      <Skeleton
        data-slot="card-skeleton-image"
        className="aspect-[3/5] w-full rounded-none"
      />
      <div className="flex flex-col gap-2 p-4">
        {/* title */}
        <Skeleton className="h-6 w-3/4" />
        {/* subtitle */}
        <Skeleton className="h-4 w-1/2" />
        {/* stat row */}
        <Skeleton className="mt-1 h-4 w-2/5" />
        {/* cta */}
        <Skeleton className="mt-2 h-8 w-full" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export { CardSkeleton }
