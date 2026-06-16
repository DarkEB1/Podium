import Link from "next/link"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
  className?: string
}

/**
 * EmptyState — centred placeholder for empty lists/searches: optional decorative
 * icon, a title, optional description, and an optional primary action that
 * renders as a Link (href) or Button (onClick). Never relies on colour alone.
 */
function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-16 text-center",
        className
      )}
    >
      {icon ? (
        <div
          data-slot="empty-state-icon"
          aria-hidden="true"
          className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6"
        >
          {icon}
        </div>
      ) : null}
      <h2 data-slot="empty-state-title" className="text-large font-heading text-foreground">
        {title}
      </h2>
      {description ? (
        <p
          data-slot="empty-state-description"
          className="text-medium max-w-prose text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
      {action ? (
        action.href ? (
          <Link
            href={action.href}
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-2")}
          >
            {action.label}
          </Link>
        ) : (
          <Button size="lg" className="mt-2" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  )
}

export { EmptyState }
