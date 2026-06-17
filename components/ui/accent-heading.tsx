import { cn } from "@/lib/utils"

type HeadingLevel = "h1" | "h2" | "h3" | "h4"

/**
 * AccentHeading — a section heading with a highlighter-style accent swipe
 * behind the text (design §7), to energise and fill section titles.
 *
 * Renders a real heading element (`as`, default h2) so document outline and
 * screen-reader navigation are preserved. The swipe is a static, decorative
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
        "relative inline-block font-heading font-semibold tracking-tight",
        className
      )}
      {...props}
    >
      <span
        data-slot="accent-swipe"
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0.5 -z-10 h-[0.45em] -rotate-1 bg-accent"
      />
      <span className="relative">{children}</span>
    </Tag>
  )
}

export { AccentHeading }
