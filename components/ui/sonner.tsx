"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { BadgeCheck, Info, TriangleAlert, OctagonX, Loader2 } from "lucide-react"

import { Icon } from "@/components/ui/icon"

// Neo-brutalist toast: bordered block + 6px left accent bar (recoloured per
// status) + hard offset shadow + Lucide status icon. Status is never conveyed
// by colour alone — every variant pairs the accent bar with a distinct icon.
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
          "--normal-border": "var(--border-ink)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Bordered block: ink border on all sides, thick recolourable left
          // accent bar, and a hard (offset, non-blurred) shadow.
          toast:
            "cn-toast group rounded-[var(--radius)] border border-border-ink border-l-[6px] border-l-border-ink shadow-card",
          // Per-status left accent bar colour. Icon + bar together so colour is
          // never the sole status signal.
          success: "border-l-success",
          info: "border-l-foreground",
          warning: "border-l-warning",
          error: "border-l-destructive",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
