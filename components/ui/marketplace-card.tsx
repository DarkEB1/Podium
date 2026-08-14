import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Bookmark, CalendarClock, Target } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { solidBlurDataURL } from "@/lib/perf/blur-placeholder"

/** Neutral on-brand silhouette used whenever no usable image is supplied (B-5). */
export const MARKETPLACE_CARD_PLACEHOLDER = "/placeholder-athlete.svg"

export interface MarketplaceCardProps {
  image: string
  imageAlt: string
  /** Image height as a fraction of the card; spec §2.4 image fills the top 60-70%. Default 0.6. */
  imageRatio?: number
  title: string
  subtitle?: string
  /**
   * PR-5 — what this person/brand is looking for. Rendered directly under the
   * name, above availability. String or arbitrary node.
   */
  seeking?: React.ReactNode
  /** PR-5 — availability line (e.g. "Available from March"). Rendered last. */
  availability?: React.ReactNode
  stat?: { label: string; value: string }
  tags?: React.ReactNode
  overlayBadges?: React.ReactNode
  cta: { label: string; href?: string; onClick?: () => void }
  saved?: boolean
  onToggleSave?: () => void
  /** When set, the whole card links here (rendered as an overlay anchor so the CTA stays clickable). */
  href?: string
  /** Highlight this card with a folded-corner accent tab (plan §6/§7). */
  featured?: boolean
  /** Tiny LQIP data URL. Defaults to the neutral surface tint. */
  blurDataURL?: string
  /** Responsive `sizes` hint for the optimizer. Defaults to a 1/2/3-up grid. */
  imageSizes?: string
  /** Skip lazy-loading for above-the-fold cards. */
  priority?: boolean
}

/** Remote hosts are not declared in next.config.ts `images.remotePatterns`;
 *  routing them through the optimizer would throw at runtime, so pass them
 *  straight through. Lazy-loading + intrinsic sizing (the CLS fix) still apply. */
function isRemote(src: string): boolean {
  return /^https?:\/\//i.test(src)
}

export function MarketplaceCard({
  image,
  imageAlt,
  imageRatio = 0.6,
  title,
  subtitle,
  seeking,
  availability,
  stat,
  tags,
  overlayBadges,
  cta,
  saved,
  onToggleSave,
  href,
  featured = false,
  blurDataURL,
  imageSizes = "(min-width: 1280px) 22rem, (min-width: 768px) 33vw, 100vw",
  priority = false,
}: MarketplaceCardProps) {
  const src = image && image.trim() !== "" ? image : MARKETPLACE_CARD_PLACEHOLDER

  return (
    <div
      data-slot="marketplace-card"
      data-testid="marketplace-card"
      data-featured={featured ? "true" : "false"}
      className={cn(
        // Clean Airbnb surface: white card, generous rounding, a single light border and
        // a soft layered shadow (--shadow-card, now soft — globals.css §1).
        "group/marketplace-card relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-card",
        // Larger surface → a slightly bigger hover lift (translateY(-4px)) than a
        // small chip (L3), degrading to shadow-only under reduced motion. globals.css.
        "liftable-lg",
        // Featured: marker class retained as a styling hook (ribbon rendered below).
        featured && "marketplace-card--featured"
      )}
    >
      {/* Featured: a soft, upright clean ribbon/pill — no hard shadow, no rotation. */}
      {featured ? (
        <span
          className="absolute right-3 top-3 z-30 inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm"
        >
          Featured
        </span>
      ) : null}

      {/*
        PR-5 — the action shot leads the card. The figure owns the aspect ratio so
        the grid reserves the exact footprint before the bytes land (no CLS), and
        A-2's next/image `fill` inherits it instead of shipping a raw <img>.
      */}
      <figure
        className="relative w-full overflow-hidden bg-muted"
        style={{ aspectRatio: String(imageRatio) }}
      >
        <Image
          src={src}
          alt={imageAlt}
          fill
          sizes={imageSizes}
          placeholder="blur"
          blurDataURL={blurDataURL ?? solidBlurDataURL()}
          unoptimized={isRemote(src)}
          {...(priority ? { priority: true } : { loading: "lazy" as const })}
          className="object-cover"
        />

        {overlayBadges ? (
          <div className="absolute left-2 top-2 z-20 flex flex-wrap gap-1">
            {overlayBadges}
          </div>
        ) : null}

        {onToggleSave ? (
          <button
            type="button"
            aria-pressed={saved ? "true" : "false"}
            aria-label={saved ? "Remove from saved" : "Add to saved"}
            onClick={onToggleSave}
            className={cn(
              "absolute right-2 top-2 z-20 inline-flex size-8 items-center justify-center rounded-full bg-card/90 text-foreground ring-1 ring-foreground/10 backdrop-blur transition-colors",
              "hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              saved && "text-primary"
            )}
          >
            <Bookmark
              className="size-4"
              aria-hidden="true"
              fill={saved ? "currentColor" : "none"}
            />
          </button>
        ) : null}
      </figure>

      {/*
        Body — PR-5 / UX-3 reading order: name → what they're seeking →
        availability. Roomier padding + explicit vertical rhythm so the card no
        longer reads as squished; `min-w-0` + wrapping keep long names contained.
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-medium leading-snug font-medium text-foreground break-words [overflow-wrap:anywhere]">
            {title}
          </h3>
          {subtitle ? (
            <p className="text-small text-muted-foreground break-words">{subtitle}</p>
          ) : null}
        </div>

        {seeking ? (
          <div
            data-slot="marketplace-card-seeking"
            className="flex min-w-0 items-start gap-2 text-small text-foreground"
          >
            <Target aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">
              <span className="sr-only">Seeking: </span>
              {seeking}
            </span>
          </div>
        ) : null}

        {availability ? (
          <div
            data-slot="marketplace-card-availability"
            className="flex min-w-0 items-start gap-2 text-small text-muted-foreground"
          >
            <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">
              <span className="sr-only">Availability: </span>
              {availability}
            </span>
          </div>
        ) : null}

        {stat ? (
          <div className="flex items-baseline gap-1">
            <span className="text-medium font-medium text-foreground">
              {stat.value}
            </span>
            <span className="text-small text-muted-foreground">{stat.label}</span>
          </div>
        ) : null}

        {tags ? <div className="flex flex-wrap gap-1">{tags}</div> : null}

        <div className="z-20 mt-auto pt-2">
          {cta.href ? (
            <Link
              href={cta.href}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full")}
            >
              {cta.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={cta.onClick}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full")}
            >
              {cta.label}
            </button>
          )}
        </div>
      </div>

      {/* Card-level link: full-bleed overlay anchor so it never nests other interactive elements. */}
      {href ? (
        <Link
          href={href}
          aria-label={title}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      ) : null}
    </div>
  )
}
