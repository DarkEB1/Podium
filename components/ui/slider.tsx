"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

/**
 * Single-value range slider.
 *
 * Wraps the Base UI slider (which renders an accessible `<input type="range">`)
 * and shows the current value, optionally run through `format` for display
 * (e.g. currency / units). Spec §4A.1, §3C.2.
 */
export function Slider({
  min = 0,
  max,
  step = 1,
  value,
  onChange,
  format,
  className,
  "aria-label": ariaLabel,
  disabled,
}: {
  /**
   * PR-17 — defaults to 0 so the low end of a budget range is reachable. The
   * old call sites started at the first meaningful tier, which made every
   * smaller budget unselectable.
   */
  min?: number
  max: number
  /**
   * Granularity. Defaults to 1 (the finest whole-currency step) rather than a
   * coarse tier width, so small budgets land on real values.
   */
  step?: number
  value: number
  onChange: (n: number) => void
  format?: (n: number) => string
  className?: string
  "aria-label"?: string
  disabled?: boolean
}) {
  const display = format ? format(value) : String(value)

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as number)}
      className={cn("flex min-w-0 flex-col gap-2", className)}
    >
      <span
        data-slot="slider-value"
        aria-hidden="true"
        className="text-medium font-medium tabular-nums text-foreground"
      >
        {display}
      </span>
      <SliderPrimitive.Control className="flex w-full items-center py-2">
        <SliderPrimitive.Track className="relative h-1 w-full rounded-full bg-muted">
          <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary" />
          <SliderPrimitive.Thumb
            aria-label={ariaLabel}
            getAriaValueText={(_formatted, v) =>
              format ? format(v) : String(v)
            }
            className={cn(
              "size-4 rounded-full bg-primary shadow-card",
              // A-4: visible focus indicator at full ring opacity (≥3:1 non-text).
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}
