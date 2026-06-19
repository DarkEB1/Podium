import { cn } from "@/lib/utils"

type HeadingLevel = "h1" | "h2" | "h3" | "h4"

/**
 * AccentHeading — a clean section heading with a subtle accent dot before the
 * text (clean Airbnb aesthetic), replacing the old highlighter swipe.
 *
 * Renders a real heading element (as, default h2) so document outline and
 * screen-reader navigation are preserved. The dot is a static, decorative
 * element (aria-hidden) — no motion, so prefers-reduced-motion needs no
 * special handling here.
 */
function AccentHeading({
  as: Tag = "h2",
  className,
  children,
  ...props
}: React.ComponentProps<"h2"> & { as?: HeadingLevel }) {
  return (
    <Tag
      data-slot="accent-heading"
      className={cn(
        "inline-flex items-center gap-2.5 font-heading font-semibold tracking-tight",
        className
      )}
      {...props}
    >
      <span
        data-slot="accent-dot"
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-accent"
      />
      <span>{children}</span>
    </Tag>
  )
}

export { AccentHeading }
