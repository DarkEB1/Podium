"use client"

import * as React from "react"
import Image from "next/image"
import { Check, X, type LucideIcon } from "lucide-react"
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react"

import { cn } from "@/lib/utils"
import { SPRING, PROJECTION_FACTOR } from "@/lib/motion/springs"
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
  /** Fires once per gesture/keypress/button press, after the card has left. */
  onSwipe?: (direction: SwipeDirection) => void
  /** Copy for the two actions; also used as the buttons' accessible names. */
  passLabel?: string
  likeLabel?: string
  /**
   * Icon for the "like" action. Defaults to a check. Surfaces where the action
   * is a save/shortlist (not an application) pass a bookmark so the control does
   * not read as "apply" (DISC8).
   */
  likeIcon?: LucideIcon
  /** Render the pass/like labels as visible captions under the buttons (DISC8). */
  showActionLabels?: boolean
  blurDataURL?: string
  /** L1: 0→1 drag magnitude the deck reads to grow the peek card toward the
   *  outgoing one. Written by this card, owned by SwipeDeck. */
  dragProgress?: MotionValue<number> | undefined
  className?: string
  /**
   * Opt-in plastic gloss sheen over the card surface (discover marketplace
   * redesign). Purely a static, non-interactive, decorative CSS gradient,
   * so it needs no reduced-motion gate. Off by default; team-side callers
   * are unaffected. When true, adds a `data-testid="swipe-gloss"` layer.
   */
  glossy?: boolean
  /**
   * Opt-in node rendered absolutely in the figure's top-left, above the
   * image (discover marketplace redesign carries the MatchScore ring here).
   * Off by default; renders nothing when omitted.
   */
  overlay?: React.ReactNode
}

/**
 * Projected-endpoint (px) past which a release counts as a committed swipe.
 * We decide by where the throw *lands* (position + velocity), not by the raw
 * release position — a fast short flick still commits (apple-design audit H1 §6).
 */
const COMMIT_PROJECTION = 120

/** Half-threshold that flips the live `data-intent` while dragging. */
const INTENT_THRESHOLD = 48

function isRemote(src: string): boolean {
  return /^https?:\/\//i.test(src)
}

/**
 * SwipeCard — PR-23, the presentational half of swipe browse mode.
 *
 * Rebuilt on Framer Motion (audit H1): the card is a real, throwable object.
 * A drag drives a `MotionValue` `x`; rotation and the like/pass badge opacity
 * are *derived* from `x` so feedback is continuous, not stepwise. Releasing
 * projects a landing point from the finger's velocity and, past the commit
 * threshold, flings the card off-screen before `onSwipe` fires — so the
 * parent's removal reads as the visible consequence of the throw.
 *
 * Pointer drag is the enhancement. The two buttons and the ← / → keys remain
 * the primary accessible path: a swipe-only interface is unusable with a
 * keyboard or a screen reader. Those paths route through the SAME commit, so a
 * button press also throws the card out for visual consequence.
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
  likeIcon,
  showActionLabels = false,
  blurDataURL,
  dragProgress,
  className,
  glossy = false,
  overlay,
}: SwipeCardProps) {
  const LikeIcon = likeIcon ?? Check
  const prefersReducedMotion = useReducedMotion()
  const articleRef = React.useRef<HTMLElement | null>(null)
  // Guards against a second commit (double key press / button while flinging).
  const committedRef = React.useRef(false)

  const x = useMotionValue(0)
  const opacity = useMotionValue(1)
  const rotate = useTransform(x, [-200, 200], [-12, 12])
  // Continuous badge feedback derived straight from x (audit H1 §1).
  const likeOpacity = useTransform(x, [40, 120], [0, 1])
  const passOpacity = useTransform(x, [-120, -40], [1, 0])

  // data-intent stays a discrete 'left' | 'right' | 'none' for styling, but is
  // now driven live off the motion value rather than React drag state.
  const [intent, setIntent] = React.useState<SwipeDirection | "none">("none")
  useMotionValueEvent(x, "change", (latest) => {
    const next: SwipeDirection | "none" =
      latest > INTENT_THRESHOLD ? "right" : latest < -INTENT_THRESHOLD ? "left" : "none"
    setIntent((prev) => (prev === next ? prev : next))
    // L1: feed drag magnitude to the deck so the peek card grows to meet the
    // outgoing one as it leaves (audit §8 telegraph). Full-grown at ~120px.
    dragProgress?.set(Math.min(Math.abs(latest) / 120, 1))
  })

  const src = image && image.trim() !== "" ? image : MARKETPLACE_CARD_PLACEHOLDER

  const commit = React.useCallback(
    (direction: SwipeDirection, velocity = 0) => {
      if (committedRef.current) return
      committedRef.current = true

      // Meaningful, causal haptic reserved for the commit frame (audit H1 §13).
      if (typeof navigator !== "undefined") navigator.vibrate?.(10)

      if (prefersReducedMotion) {
        // No throw: cross-fade the outgoing card out, then report (audit §14).
        animate(opacity, 0, {
          duration: 0.2,
          onComplete: () => onSwipe?.(direction),
        })
        return
      }

      // Guarantee the card fully leaves regardless of viewport width.
      const width = articleRef.current?.offsetWidth ?? 400
      const offscreen = Math.max(width * 1.5, 600)
      // Continue at the finger's release velocity — no seam (audit §5 handoff).
      animate(x, direction === "right" ? offscreen : -offscreen, {
        ...SPRING.momentum,
        velocity,
        onComplete: () => onSwipe?.(direction),
      })
    },
    [onSwipe, opacity, prefersReducedMotion, x]
  )

  function handleDragEnd(_event: unknown, info: { velocity: { x: number } }) {
    // Decide by the PROJECTED endpoint (position + velocity), not release
    // position — a fast short flick still commits (audit H1 §6).
    const projected = x.get() + info.velocity.x * PROJECTION_FACTOR
    if (projected > COMMIT_PROJECTION) commit("right", info.velocity.x)
    else if (projected < -COMMIT_PROJECTION) commit("left", info.velocity.x)
    else if (prefersReducedMotion) x.set(0) // settle instantly
    else animate(x, 0, SPRING.default) // interruptible settle home
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      commit("right")
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      commit("left")
    }
  }

  return (
    <motion.article
      ref={articleRef}
      data-slot="swipe-card"
      data-testid="swipe-card"
      data-intent={intent}
      aria-roledescription="Swipeable card"
      aria-label={title}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      drag="x"
      dragElastic={0.5}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity }}
      className={cn(
        "relative flex w-full min-w-0 max-w-sm touch-pan-y flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-card select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "motion-reduce:transition-none",
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
        {glossy ? (
          // Static plastic sheen (direction-b-editorial score-chip material):
          // a soft top highlight fading down, plus a faint inner top-left
          // glow. No motion is involved, so no prefers-reduced-motion gate
          // is needed, since a static gradient cannot trigger vestibular
          // discomfort. Deliberately no z-index: it is first in DOM order
          // inside the figure, so the later like/pass drag badges (also
          // z-index:auto) paint above it and stay legible.
          <div
            aria-hidden="true"
            data-testid="swipe-gloss"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_45%),radial-gradient(120%_60%_at_18%_0%,rgba(255,255,255,0.30),rgba(255,255,255,0)_60%)]"
          />
        ) : null}
        {overlay ? (
          <div className="absolute left-3 top-3 z-10">{overlay}</div>
        ) : null}
        <motion.span
          aria-hidden="true"
          style={{ opacity: likeOpacity }}
          className="absolute top-4 left-4 rounded-lg border-2 border-success px-3 py-1 text-medium font-semibold uppercase text-success"
        >
          {likeLabel}
        </motion.span>
        <motion.span
          aria-hidden="true"
          style={{ opacity: passOpacity }}
          className="absolute top-4 right-4 rounded-lg border-2 border-destructive px-3 py-1 text-medium font-semibold uppercase text-destructive"
        >
          {passLabel}
        </motion.span>
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

        <div className="mt-2 flex items-start justify-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              aria-label={passLabel}
              onClick={() => commit("left")}
              className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-card text-destructive shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
            {showActionLabels ? (
              <span aria-hidden="true" className="text-small text-muted-foreground">
                {passLabel}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              aria-label={likeLabel}
              onClick={() => commit("right")}
              className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-card text-success shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <LikeIcon aria-hidden="true" className="size-5" />
            </button>
            {showActionLabels ? (
              <span aria-hidden="true" className="text-small text-muted-foreground">
                {likeLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </motion.article>
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

  // L1: the head card writes its drag magnitude here; the peek grows toward it.
  // Hooks run before the early return (Rules of Hooks). Reset on head advance so
  // each new peek starts small. Reduced motion keeps it static (baseline below).
  const reducedMotion = useReducedMotion()
  const peekProgress = useMotionValue(0)
  const peekScale = useTransform(peekProgress, [0, 1], [0.95, 1])
  const peekOpacity = useTransform(peekProgress, [0, 1], [0.6, 1])
  const headId = head?.id
  React.useEffect(() => {
    peekProgress.set(0)
  }, [headId, peekProgress])

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
           duplicate set of Pass/Interested buttons in the tab order. The scale
           and opacity are driven by the head card's drag (L1) so the peek rises
           to meet the outgoing card. */
        <motion.div
          aria-hidden="true"
          data-testid="swipe-deck-peek"
          style={{ scale: peekScale, opacity: peekOpacity }}
          className="pointer-events-none absolute inset-x-0 top-2 mx-auto h-full w-full max-w-sm rounded-2xl border border-border bg-card shadow-card"
        />
      ) : null}
      <div className="relative w-full max-w-sm">
        {/* key by id: remount a fresh card per head so its drag MotionValue (x)
            resets to centre — otherwise the next card inherits the flung
            position/rotation of the one just thrown. */}
        <SwipeCard
          key={head.id}
          {...head}
          dragProgress={reducedMotion ? undefined : peekProgress}
          onSwipe={(direction) => onSwipe?.(head.id, direction)}
        />
      </div>
    </div>
  )
}
