import * as React from "react"
import { BadgeCheck, Circle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/**
 * LevelChip — competition/skill level shown as a flat accent block with the
 * shared ink border (spec §2.4, §3B.1, §6 re-skin).
 */
function LevelChip({ level }: { level: string }) {
  return (
    <Badge className="bg-accent/15 text-accent-foreground">
      <span className="font-medium">{level}</span>
    </Badge>
  )
}

type AvailabilityStatus = "available_now" | "available_from" | "not_available"

const availabilityConfig: Record<
  AvailabilityStatus,
  { label: string; className: string }
> = {
  available_now: {
    label: "Available now",
    className: "bg-success/15 text-success",
  },
  available_from: {
    label: "Available from",
    className: "bg-warning/15 text-warning",
  },
  not_available: {
    label: "Not available",
    className: "bg-destructive/15 text-destructive",
  },
}

/**
 * AvailabilityBadge — green/amber/red availability state as a flat block + ink
 * border. ALWAYS pairs a Lucide `Circle` icon with the label so meaning is never
 * conveyed by colour alone (spec §6, §10 accessibility). The icon inherits the
 * status colour via `currentColor` and the label distinguishes the three states.
 * `available_from` appends the optional `date` to the label.
 */
function AvailabilityBadge({
  status,
  date,
}: {
  status: AvailabilityStatus
  date?: string
}) {
  const { label, className } = availabilityConfig[status]
  const text =
    status === "available_from" && date ? `${label} ${date}` : label

  return (
    <Badge className={className}>
      <Icon icon={Circle} size={12} className="fill-current" />
      <span>{text}</span>
    </Badge>
  )
}

/**
 * VerifiedBadge — blue "Verified" with a `BadgeCheck` icon, or grey "Unverified"
 * (spec §3B.1, §6). The icon backs the colour so verified state reads without
 * relying on colour alone; the unverified label is self-describing.
 */
function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <Badge className="bg-primary/10 text-primary">
        <Icon icon={BadgeCheck} size={12} />
        <span>Verified</span>
      </Badge>
    )
  }

  return (
    <Badge className="bg-muted text-muted-foreground">
      <span>Unverified</span>
    </Badge>
  )
}

/**
 * SeekingTag — low-opacity primary block + ink border, used for "seeking
 * sponsor" style marketplace tags (spec §2.4, §6).
 */
function SeekingTag({ children }: { children: React.ReactNode }) {
  return (
    <Badge className={cn("bg-primary/10 text-primary")}>{children}</Badge>
  )
}

export { LevelChip, AvailabilityBadge, VerifiedBadge, SeekingTag }
