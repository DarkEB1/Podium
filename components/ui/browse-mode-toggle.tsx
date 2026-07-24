"use client"

import * as React from "react"
import { LayoutGrid, Layers } from "lucide-react"

import { cn } from "@/lib/utils"

/** Mirrors the `public.ui_mode` enum: 'marketplace' (Airbnb grid) | 'swipe'. */
export type BrowseMode = "marketplace" | "swipe"

export interface BrowseModeToggleProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value: BrowseMode
  onChange: (mode: BrowseMode) => void
  /** Disable while the preference is being persisted. */
  pending?: boolean
  labels?: { marketplace?: string; swipe?: string }
}

const MODES: BrowseMode[] = ["marketplace", "swipe"]

/**
 * BrowseModeToggle — PR-23.
 *
 * Both browse modes ship at launch, so this is a real control, not decoration.
 * It is a proper radiogroup (arrow keys move between options, Space/Enter
 * selects) rather than two loose buttons, and it is fully controlled: the
 * caller owns `value` and persists it to `profiles.discovery_ui_mode`.
 */
export function BrowseModeToggle({
  value,
  onChange,
  pending = false,
  labels,
  className,
  ...props
}: BrowseModeToggleProps) {
  const text: Record<BrowseMode, string> = {
    marketplace: labels?.marketplace ?? "Grid",
    swipe: labels?.swipe ?? "Swipe",
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return
    e.preventDefault()
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1
    const next = MODES[(MODES.indexOf(value) + dir + MODES.length) % MODES.length]
    if (next) onChange(next)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Browse mode"
      data-slot="browse-mode-toggle"
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border bg-muted p-1",
        pending && "opacity-60",
        className
      )}
      {...props}
    >
      {MODES.map((mode) => {
        const selected = value === mode
        const Icon = mode === "marketplace" ? LayoutGrid : Layers
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            // Roving tabindex: one stop for the whole group.
            tabIndex={selected ? 0 : -1}
            disabled={pending}
            data-mode={mode}
            onClick={() => onChange(mode)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-small font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {text[mode]}
          </button>
        )
      })}
    </div>
  )
}
