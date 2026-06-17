import { cn } from "@/lib/utils"

/**
 * SectionDivider — an ink rule with a solid label chip (design §7), e.g.
 * "Your shortlist". Used to break long pages into legible sections and
 * fill empty horizontal space with a little weight.
 *
 * The label is a real, visible text label (a11y); the rule is decorative.
 */
function SectionDivider({
  label,
  className,
  ...props
}: React.ComponentProps<"div"> & { label: string }) {
  return (
    <div
      data-slot="section-divider"
      className={cn("flex w-full items-center gap-3", className)}
      {...props}
    >
      <span
        data-slot="divider-label"
        className="inline-flex shrink-0 items-center rounded-md border-[length:var(--border-ink-width)] border-border-ink bg-foreground px-2.5 py-1 font-heading text-xs font-semibold tracking-tight text-background uppercase"
      >
        {label}
      </span>
      <span
        data-slot="divider-rule"
        aria-hidden="true"
        className="h-px flex-1 bg-border-ink"
      />
    </div>
  )
}

export { SectionDivider }
