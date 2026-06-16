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
  min,
  max,
  step = 1,
  value,
  onChange,
  format,
  className,
}: {
  min: number
  max: number
  step?: number
  value: number
  onChange: (n: number) => void
  format?: (n: number) => string
  className?: string
}) {
  const display = format ? format(value) : String(value)

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={(next) => onChange(next as number)}
      className={cn("flex flex-col gap-2", className)}
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
            getAriaValueText={(_formatted, v) =>
              format ? format(v) : String(v)
            }
            className={cn(
              "size-4 rounded-full bg-primary shadow-card",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            )}
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}
