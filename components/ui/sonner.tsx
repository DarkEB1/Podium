"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { BadgeCheck, Info, TriangleAlert, OctagonX, Loader2 } from "lucide-react"

import { Icon } from "@/components/ui/icon"

// Clean Airbnb toast: white rounded-xl card, single light border, soft layered
// shadow, and a small coloured Lucide status icon. Status is never conveyed by
// colour alone — every variant pairs a subtly coloured icon with a distinct
// glyph. No hard left bar, no offset shadow, no rotation.
const Toaster = (props: Omit<ToasterProps, "theme">) => {
  const { theme } = useTheme()
  const sonnerTheme: "system" | "light" | "dark" =
    theme === "light" || theme === "dark" ? theme : "system"

  return (
    <Sonner
      theme={sonnerTheme}
      className="toaster group"
      icons={{
        success: <Icon icon={BadgeCheck} size={18} className="text-success" />,
        info: <Icon icon={Info} size={18} className="text-foreground" />,
        warning: <Icon icon={TriangleAlert} size={18} className="text-warning" />,
        error: <Icon icon={OctagonX} size={18} className="text-destructive" />,
        loading: <Icon icon={Loader2} size={18} className="animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Clean white card: single light border, generous rounded corners,
          // soft layered shadow, roomy padding. Status comes from the coloured
          // Lucide icon, so colour is never the sole signal.
          toast:
            "cn-toast group rounded-xl border border-border bg-popover px-4 py-3 shadow-card",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
