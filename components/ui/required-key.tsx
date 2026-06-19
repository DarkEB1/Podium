import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Form legend explaining the required-field marker (spec §9.4).
 * Renders "* Required field". The asterisk is decorative (aria-hidden) so a
 * screen reader announces "Required field" once rather than reading the
 * standalone glyph.
 */
function RequiredKey({ className }: { className?: string }) {
  return (
    <p
      data-slot="required-key"
      className={cn(
        "flex items-center gap-1 text-small text-muted-foreground",
        className
      )}
    >
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
      Required field
    </p>
  )
}

export { RequiredKey }
