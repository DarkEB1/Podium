import * as React from "react"
import { BadgeCheck, CalendarClock, CircleCheck, CircleX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * LevelChip — competition/skill level shown as an accent pill (spec §2.4, §3B.1).
 */
function LevelChip({ level }: { level: string }) {
  return (
    <Badge className="border-accent/30 bg-accent/15 text-accent-foreground">
      <span className="font-medium">{level}</span>
    </Badge>
  )
}

type AvailabilityStatus = "available_now" | "available_from" | "not_available"

const availabilityConfig: Record<
  AvailabilityStatus,
  { label: string; className: string; Icon: typeof CircleCheck }
> = {
  available_now: {
    label: "Available now",
    className: "border-success/30 bg-success/15 text-success",
    Icon: CircleCheck,
  },
  available_from: {
    label: "Available from",
    className: "border-warning/40 bg-warning/15 text-warning",
    Icon: CalendarClock,
  },
  not_available: {
    label: "Not available",
    className: "border-destructive/30 bg-destructive/15 text-destructive",
    Icon: CircleX,
  },
}

/**
 * AvailabilityBadge — green/amber/red availability state. Always pairs an icon
 * with the label so meaning is never conveyed by colour alone (spec §6A.1, §9.4).
 * `available_from` appends the optional `date` to the label.
 */
function AvailabilityBadge({
  status,
  date,
}: {
  status: AvailabilityStatus
  date?: string
}) {
  const { label, className, Icon } = availabilityConfig[status]
  const text =
    status === "available_from" && date ? `${label} ${date}` : label

  return (
    <Badge className={className}>
      <Icon aria-hidden="true" />
      <span>{text}</span>
    </Badge>
  )
}

/**
 * VerifiedBadge — blue "Verified" with a check icon, or grey "Unverified"
 * (spec §3B.1). Icon backs the colour so the state reads without colour alone.
 */
function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <Badge className="border-primary/30 bg-primary/10 text-primary">
        <BadgeCheck aria-hidden="true" />
        <span>Verified</span>
      </Badge>
    )
  }

  return (
    <Badge className="border-border bg-muted text-muted-foreground">
      <span>Unverified</span>
    </Badge>
  )
}

/**
 * SeekingTag — low-opacity accent background with accent text, used for
 * "seeking sponsor" style marketplace tags (spec §2.4).
 */
function SeekingTag({ children }: { children: React.ReactNode }) {
  return (
    <Badge className={cn("border-transparent bg-accent/15 text-accent-foreground")}>
      {children}
    </Badge>
  )
}

export { LevelChip, AvailabilityBadge, VerifiedBadge, SeekingTag }
