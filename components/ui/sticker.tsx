import { cn } from "@/lib/utils"

/**
 * Sticker — a flat, upright soft pill/badge used for promotional tags like
 * "Most popular", "7-day free trial" or "Featured" (clean Airbnb aesthetic).
 *
 * A warm accent fill, rounded-full shape and a soft shadow give it a friendly,
 * premium feel without any tilt, ink border or hard offset shadow. There is no
 * motion, so prefers-reduced-motion needs no special handling.
 *
 * `rotate` is accepted for backward compatibility but intentionally ignored —
 * the clean sticker is always upright.
 */
function Sticker({
  className,
  rotate: _rotate,
  children,
  ...props
}: React.ComponentProps<"span"> & { rotate?: number }) {
  void _rotate
  return (
    <span
      data-slot="sticker"
      className={cn(
        "inline-flex w-fit items-center justify-center gap-1.5 rounded-full bg-accent px-3.5 py-1 font-heading text-xs font-semibold tracking-tight text-accent-foreground uppercase shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Sticker }
