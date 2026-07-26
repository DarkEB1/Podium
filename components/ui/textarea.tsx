"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /**
   * Grow the box with its content instead of scrolling from the first line.
   * Caps at `maxHeight` (px), after which the textarea scrolls internally.
   * PR-18: opt-in so existing fixed-height textareas keep their layout.
   */
  autoGrow?: boolean
  /** Max height in px when `autoGrow` is on. Default 160 (≈6 lines). */
  maxHeight?: number
}

/**
 * Textarea — always wraps, never widens its container.
 *
 * PR-18: the composer used to blow out of the viewport because the element had
 * no `min-w-0`. A flex/grid child defaults to `min-width:auto`, which resolves
 * to its *content* width, so a long unbroken run of characters forces the flex
 * item wider than the row and the whole page scrolls sideways. `w-full min-w-0`
 * plus `break-words` (and `wrap="soft"`, the default) confines the text.
 */
function Textarea({
  className,
  autoGrow = false,
  maxHeight = 160,
  onChange,
  ref,
  ...props
}: TextareaProps) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

  const resize = React.useCallback(() => {
    const el = innerRef.current
    if (!el || !autoGrow) return
    // Collapse first so shrinking works, then grow to content up to the cap.
    el.style.height = "auto"
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden"
  }, [autoGrow, maxHeight])

  // Re-measure on mount and whenever the value is driven from outside (e.g. the
  // composer clearing itself after a send).
  React.useLayoutEffect(() => {
    resize()
  }, [resize, props.value])

  return (
    <textarea
      data-slot="textarea"
      ref={(node) => {
        innerRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      }}
      onChange={(e) => {
        onChange?.(e)
        resize()
      }}
      style={autoGrow ? { maxHeight, ...props.style } : props.style}
      className={cn(
        // PR-18 — width containment + wrapping.
        "block w-full min-w-0 max-w-full break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
        autoGrow ? "resize-none overflow-y-auto" : "field-sizing-content min-h-20",
        "rounded-xl border border-input bg-card px-3.5 py-2.5 text-base shadow-sm transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/40 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
