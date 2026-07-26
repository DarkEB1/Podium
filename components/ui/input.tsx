import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // A-3/A-4: `border-input` (3.47:1 on the page) is the control boundary —
        // `border-border` is a 1.17:1 decorative hairline and fails WCAG 1.4.11.
        // Focus ring uses the full-opacity ring token plus an offset so it is
        // visible against both the field and the surrounding surface.
        "h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 py-2 text-base shadow-sm transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/40 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
