import { cn } from "@/lib/utils"

/**
 * Live character counter rendered as "n/max characters".
 *
 * Goes destructive (and stays a visible text cue, not colour-alone) when the
 * value exceeds `max`. Announced politely to assistive tech as it updates.
 * Spec §4A.1, §3C.2.
 */
export function CharacterCounter({
  value,
  max,
}: {
  value: string
  max: number
}) {
  const count = value.length
  const over = count > max

  return (
    <span
      data-slot="character-counter"
      aria-live="polite"
      className={cn(
        "text-small tabular-nums text-muted-foreground",
        over && "font-medium text-destructive"
      )}
    >
      {count}/{max} characters
    </span>
  )
}
