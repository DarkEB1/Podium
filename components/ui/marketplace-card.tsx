import * as React from "react"
import Link from "next/link"
import { Bookmark } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export interface MarketplaceCardProps {
  image: string
  imageAlt: string
  /** Image height as a fraction of the card; spec §2.4 image fills the top 60-70%. Default 0.6. */
  imageRatio?: number
  title: string
  subtitle?: string
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
}

export function MarketplaceCard({
  image,
  imageAlt,
  imageRatio = 0.6,
  title,
  subtitle,
  stat,
  tags,
  overlayBadges,
  cta,
  saved,
  onToggleSave,
  href,
  featured = false,
}: MarketplaceCardProps) {
  return (
    <div
      data-slot="marketplace-card"
      data-testid="marketplace-card"
      data-featured={featured ? "true" : "false"}
      className={cn(
        // Clean Airbnb surface: white card, generous rounding, a single light border and
        // a soft layered shadow (--shadow-card, now soft — globals.css §1).
        "group/marketplace-card relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-card",
        // Gentle hover lift: translateY(-2px) → soft elevated shadow over ~180ms, degrades
        // to shadow-only under prefers-reduced-motion. Centralised in globals.css §1.5.
        "liftable",
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

      {/* Image — fills the top 60-70% of the card. aspect-ratio = width fraction interpreted as ratio token. */}
      <figure
        className="relative w-full overflow-hidden bg-muted"
        style={{ aspectRatio: String(imageRatio) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- A8 BlurImage not required by this primitive's API; src is a presigned/public URL */}
        <img
          src={image}
          alt={imageAlt}
          className="h-full w-full object-cover"
          loading="lazy"
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
              "hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
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

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-heading text-medium leading-snug font-medium text-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="text-small text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

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
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      ) : null}
    </div>
  )
}
