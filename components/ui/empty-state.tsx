import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"

type EmptyStateVariant = keyof typeof copy.emptyStates

export interface EmptyStateProps {
  /** Pre-filled title/body/CTA copy. Explicit props below override per field. */
  variant?: EmptyStateVariant
  /** Arbitrary decorative node rendered inside the accent disc. */
  icon?: React.ReactNode
  /** Lucide icon rendered (via the `Icon` wrapper) inside the accent disc. */
  iconComponent?: LucideIcon
  title?: string
  description?: string
  /** `label` is optional when a `variant` supplies a default CTA label. */
  action?: { label?: string; href?: string; onClick?: () => void }
  className?: string
}

/**
 * EmptyState — characterful placeholder for empty lists/searches: a circular
 * accent disc holding a Lucide `Icon` (or arbitrary node), an energetic title,
 * supporting body copy, and an optional primary action rendered as a Link
 * (href) or Button (onClick).
 *
 * Pass a `variant` to default title/body/CTA from `copy.emptyStates`; any
 * explicit `title`/`description`/`action.label` overrides the variant's copy.
 *
 * Accessibility: the title is a real heading; the disc is purely decorative
 * (`aria-hidden`) so meaning never rests on the icon or its colour alone.
 */
function EmptyState({
  variant,
  icon,
  iconComponent: IconComponent,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const defaults = variant ? copy.emptyStates[variant] : undefined

  const resolvedTitle = title ?? defaults?.title ?? ""
  const resolvedDescription = description ?? defaults?.body ?? undefined
  const resolvedCtaLabel = action?.label ?? defaults?.cta ?? undefined

  // Render an action only when we have both a label and a way to invoke it.
  const showAction =
    resolvedCtaLabel != null && (action?.href != null || action?.onClick != null)

  const discContent = icon ?? (IconComponent ? <Icon icon={IconComponent} size={28} /> : null)

  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 py-16 text-center",
        className
      )}
    >
      {discContent ? (
        <div
          data-slot="empty-state-icon"
          aria-hidden="true"
          className="mb-1 flex size-16 items-center justify-center rounded-full border-[length:var(--border-ink-width)] border-border-ink bg-accent text-accent-foreground shadow-card [&_svg]:size-7"
        >
          {discContent}
        </div>
      ) : null}
      <h2 data-slot="empty-state-title" className="text-large font-heading text-foreground">
        {resolvedTitle}
      </h2>
      {resolvedDescription ? (
        <p
          data-slot="empty-state-description"
          className="text-medium max-w-prose text-muted-foreground"
        >
          {resolvedDescription}
        </p>
      ) : null}
      {showAction ? (
        action?.href ? (
          <Link
            href={action.href}
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-2")}
          >
            {resolvedCtaLabel}
          </Link>
        ) : (
          <Button size="lg" className="mt-2" onClick={action?.onClick}>
            {resolvedCtaLabel}
          </Button>
        )
      ) : null}
    </div>
  )
}

export { EmptyState }
