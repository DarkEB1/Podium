import { cn } from "@/lib/utils"

/**
 * Sticker — a rotated accent pill used for promotional tags like
 * "Most popular", "7-day free trial" or "Featured" (design §7).
 * Accent fill + ink border + hard offset shadow; tilted by default for
 * a hand-applied sticker feel. The tilt is a static transform (no motion),
 * so there is nothing to gate behind prefers-reduced-motion.
 */
function Sticker({
  className,
  rotate = -3,
  style,
  children,
  ...props
}: React.ComponentProps<"span"> & { rotate?: number }) {
  return (
    <span
      data-slot="sticker"
      style={{ transform: `rotate(${rotate}deg)`, ...style }}
      className={cn(
        "inline-flex w-fit items-center justify-center gap-1 rounded-4xl border-[length:var(--border-ink-width)] border-border-ink bg-accent px-3 py-1 font-heading text-xs font-semibold tracking-tight text-accent-foreground uppercase shadow-card",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Sticker }
