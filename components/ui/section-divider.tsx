import { cn } from "@/lib/utils"

/**
 * SectionDivider — a light hairline rule with an optional soft label (clean
 * Airbnb aesthetic), e.g. "Your shortlist". Used to break long pages into
 * legible sections with generous, calm whitespace.
 *
 * The label, when present, is a real visible text label (a11y) styled as a
 * subtle muted eyebrow; the rule is decorative.
 */
function SectionDivider({
  label,
  className,
  ...props
}: React.ComponentProps<"div"> & { label?: string }) {
  return (
    <div
      data-slot="section-divider"
      className={cn("flex w-full items-center gap-4", className)}
      {...props}
    >
      {label ? (
        <span
          data-slot="divider-label"
          className="inline-flex shrink-0 items-center font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </span>
      ) : null}
      <span
        data-slot="divider-rule"
        aria-hidden="true"
        className="h-px flex-1 bg-border"
      />
    </div>
  )
}

export { SectionDivider }
