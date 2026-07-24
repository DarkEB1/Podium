"use client"

import * as React from "react"
import Image from "next/image"
import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { solidBlurDataURL } from "@/lib/perf/blur-placeholder"
import { EmptyState } from "@/components/ui/empty-state"
import { MARKETPLACE_CARD_PLACEHOLDER } from "@/components/ui/marketplace-card"

export type SwipeDirection = "left" | "right"

export interface SwipeCardProps {
  image: string
  imageAlt: string
  title: string
  subtitle?: string
  /** What they're looking for — same reading order as MarketplaceCard (PR-5). */
  seeking?: React.ReactNode
  availability?: React.ReactNode
  tags?: React.ReactNode
  /** Fires once per gesture/keypress/button press. */
  onSwipe?: (direction: SwipeDirection) => void
  /** Copy for the two actions; also used as the buttons' accessible names. */
  passLabel?: string
  likeLabel?: string
  blurDataURL?: string
  className?: string
}

/** Horizontal travel (px) past which a drag counts as a swipe. */
const SWIPE_THRESHOLD = 96

function isRemote(src: string): boolean {
  return /^https?:\/\//i.test(src)
}

/**
 * SwipeCard — PR-23, the presentational half of swipe browse mode.
 *
 * Pointer drag, keyboard (← / →) and two explicit buttons all funnel into the
 * same `onSwipe`. The buttons are not a fallback afterthought: a swipe-only
 * interface is unusable with a keyboard or a screen reader, so they are the
 * primary accessible path and the drag is the enhancement.
 *
 * The component owns no queue state — the parent decides what the next card is.
 */
export function SwipeCard({
  image,
  imageAlt,
  title,
  subtitle,
  seeking,
  availability,
  tags,
  onSwipe,
  passLabel = "Pass",
  likeLabel = "Interested",
  blurDataURL,
  className,
}: SwipeCardProps) {
  const [dragX, setDragX] = React.useState(0)
  const startX = React.useRef<number | null>(null)
  // Mirror of dragX for the pointerup handler: reading it from state would use
  // whatever value that particular render closed over.
  const dragXRef = React.useRef(0)

  const setDrag = React.useCallback((next: number) => {
    dragXRef.current = next
    setDragX(next)
  }, [])
  const src = image && image.trim() !== "" ? image : MARKETPLACE_CARD_PLACEHOLDER

  const commit = React.useCallback(
    (direction: SwipeDirection) => {
      setDrag(0)
      startX.current = null
      onSwipe?.(direction)
    },
    [onSwipe, setDrag]
  )

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // jsdom / unsupported pointer id — capture is an enhancement, not required.
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return
    setDrag(e.clientX - startX.current)
  }

  function handlePointerUp() {
    if (startX.current === null) return
    const dx = dragXRef.current
    if (dx > SWIPE_THRESHOLD) commit("right")
    else if (dx < -SWIPE_THRESHOLD) commit("left")
    else {
      setDrag(0)
      startX.current = null
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      commit("right")
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      commit("left")
    }
  }

  const intent: SwipeDirection | null =
    dragX > SWIPE_THRESHOLD / 2 ? "right" : dragX < -SWIPE_THRESHOLD / 2 ? "left" : null

  return (
    <article
      data-slot="swipe-card"
      data-testid="swipe-card"
      data-intent={intent ?? "none"}
      aria-roledescription="Swipeable card"
      aria-label={title}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: dragX ? `translateX(${dragX}px) rotate(${dragX / 28}deg)` : undefined,
      }}
      className={cn(
        "relative flex w-full min-w-0 max-w-sm touch-pan-y flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-card select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        !dragX && "transition-transform duration-200 motion-reduce:transition-none",
        className
      )}
    >
      <p className="sr-only">
        Use the left and right arrow keys, or the {passLabel} and {likeLabel} buttons.
      </p>

      <figure className="relative w-full overflow-hidden bg-muted" style={{ aspectRatio: "0.8" }}>
        <Image
          src={src}
          alt={imageAlt}
          fill
          sizes="(min-width: 640px) 24rem, 100vw"
          placeholder="blur"
          blurDataURL={blurDataURL ?? solidBlurDataURL()}
          unoptimized={isRemote(src)}
          loading="lazy"
          draggable={false}
          className="object-cover"
        />
        {intent ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-4 rounded-lg border-2 px-3 py-1 text-medium font-semibold uppercase",
              intent === "right"
                ? "left-4 border-success text-success"
                : "right-4 border-destructive text-destructive"
            )}
          >
            {intent === "right" ? likeLabel : passLabel}
          </span>
        ) : null}
      </figure>

      <div className="flex min-w-0 flex-col gap-3 p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-large leading-snug font-medium break-words [overflow-wrap:anywhere]">
            {title}
          </h3>
          {subtitle ? (
            <p className="text-small text-muted-foreground break-words">{subtitle}</p>
          ) : null}
        </div>
        {seeking ? (
          <p className="text-small break-words">
            <span className="text-muted-foreground">Seeking: </span>
            {seeking}
          </p>
        ) : null}
        {availability ? (
          <p className="text-small text-muted-foreground break-words">
            <span className="sr-only">Availability: </span>
            {availability}
          </p>
        ) : null}
        {tags ? <div className="flex flex-wrap gap-1">{tags}</div> : null}

        <div className="mt-2 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label={passLabel}
            onClick={() => commit("left")}
            className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-card text-destructive shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            aria-label={likeLabel}
            onClick={() => commit("right")}
            className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-card text-success shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Check aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
    </article>
  )
}

export interface SwipeDeckProps {
  /** Ordered queue; only the head is rendered interactively. */
  cards: (SwipeCardProps & { id: string })[]
  onSwipe?: (id: string, direction: SwipeDirection) => void
  /** Rendered when the queue empties. Defaults to the shared EmptyState. */
  empty?: React.ReactNode
  className?: string
}

/**
 * SwipeDeck — renders the head of a card queue plus a peeked next card, and an
 * empty state when the queue runs dry (UX-1: no blank screens).
 */
export function SwipeDeck({ cards, onSwipe, empty, className }: SwipeDeckProps) {
  const [head, next] = cards

  if (!head) {
    return (
      <div data-slot="swipe-deck" data-testid="swipe-deck" className={className}>
        {empty ?? <EmptyState variant="noResults" />}
      </div>
    )
  }

  return (
    <div
      data-slot="swipe-deck"
      data-testid="swipe-deck"
      className={cn("relative flex min-w-0 justify-center", className)}
    >
      {next ? (
        /* Depth cue only. Rendering a second real SwipeCard here would put a
           duplicate set of Pass/Interested buttons in the tab order. */
        <div
          aria-hidden="true"
          data-testid="swipe-deck-peek"
          className="pointer-events-none absolute inset-x-0 top-2 mx-auto h-full w-full max-w-sm scale-95 rounded-2xl border border-border bg-card opacity-60 shadow-card"
        />
      ) : null}
      <div className="relative w-full max-w-sm">
        <SwipeCard {...head} onSwipe={(direction) => onSwipe?.(head.id, direction)} />
      </div>
    </div>
  )
}
