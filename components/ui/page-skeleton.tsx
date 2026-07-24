import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { CardSkeleton } from "@/components/ui/card-skeleton"

/**
 * PageSkeleton — B-11 / UX-1.
 *
 * The shared body of every `loading.tsx`. Each variant mirrors the real
 * layout's footprint so the swap to live data does not shift anything.
 *
 * One `role="status" aria-busy` region per page (not per tile) — a screen
 * reader should hear "Loading" once, not twenty times.
 */
export type PageSkeletonVariant = "grid" | "list" | "detail" | "chat" | "form"

export interface PageSkeletonProps {
  variant?: PageSkeletonVariant
  /** Tiles/rows to reserve. Defaults per variant. */
  count?: number
  /** Reserve space for the page title block. */
  heading?: boolean
  label?: string
  className?: string
}

function HeadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-2/3 max-w-sm rounded-xl" />
      <Skeleton className="h-4 w-1/2 max-w-xs rounded-lg" />
    </div>
  )
}

export function PageSkeleton({
  variant = "grid",
  count,
  heading = true,
  label = "Loading",
  className,
}: PageSkeletonProps) {
  const n = count ?? (variant === "grid" ? 6 : variant === "list" ? 5 : 1)

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-slot="page-skeleton"
      data-testid="page-skeleton"
      data-variant={variant}
      className={cn(
        "mx-auto w-full max-w-6xl space-y-8 px-6 py-10 md:px-16",
        // Reduced motion: the pulse is a movement cue; freeze it for opt-outs.
        "[&_[data-slot=skeleton]]:motion-reduce:animate-none",
        className
      )}
    >
      {heading ? <HeadingSkeleton /> : null}

      {variant === "grid" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: n }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : null}

      {variant === "list" ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: n }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3 rounded-lg" />
                <Skeleton className="h-3 w-2/3 rounded-lg" />
              </div>
              <Skeleton className="hidden h-8 w-20 rounded-xl sm:block" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "detail" ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="aspect-[16/6] w-full rounded-2xl" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-1/3 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-5/6 rounded-lg" />
            <Skeleton className="h-4 w-3/4 rounded-lg" />
          </div>
        </div>
      ) : null}

      {variant === "chat" ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: count ?? 6 }, (_, i) => (
            <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
              <Skeleton
                className={cn("h-10 rounded-2xl", i % 2 ? "w-2/5" : "w-1/2")}
              />
            </div>
          ))}
          <Skeleton className="mt-4 h-10 w-full rounded-xl" />
        </div>
      ) : null}

      {variant === "form" ? (
        <div className="flex max-w-xl flex-col gap-5">
          {Array.from({ length: count ?? 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24 rounded-lg" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      ) : null}

      <span className="sr-only">{label}…</span>
    </div>
  )
}
