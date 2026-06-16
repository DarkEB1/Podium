import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * CardSkeleton — placeholder that mirrors MarketplaceCard's proportions so the
 * grid reserves the same footprint while data loads, preventing layout shift.
 * The image block uses aspect-[3/5] (= 0.6, MarketplaceCard's default imageRatio).
 */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="card-skeleton"
      role="status"
      aria-busy="true"
      className={cn(
        "overflow-hidden rounded-[--radius] border border-border bg-card shadow-[--shadow-card]",
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
