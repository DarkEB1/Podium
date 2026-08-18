import * as React from "react"
import { BadgeCheck, Circle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/**
 * LevelChip — competition/skill level shown as a soft, tinted accent pill
 * (clean Airbnb re-skin: no ink border, rounded-full via the shared Badge).
 *
 * Long labels ("Semi-Professional") used to be clipped mid-word by the base
 * Badge's `whitespace-nowrap overflow-hidden` inside narrow cards, so this
 * chip alone may shrink and truncates with an ellipsis; the full label stays
 * available through the `title` attribute. Other Badge uses are untouched.
 */
function LevelChip({ level }: { level: string }) {
  return (
    <Badge
      title={level}
      className="min-w-0 max-w-full shrink bg-accent/15 text-accent-foreground"
    >
      <span className="min-w-0 truncate font-medium">{level}</span>
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
 * AvailabilityBadge — green/amber/red availability state as a soft, tinted pill
 * (clean Airbnb re-skin: no ink border). ALWAYS pairs a Lucide `Circle` icon
 * with the label so meaning is never conveyed by colour alone (accessibility).
 * The icon inherits the status colour via `currentColor` and the label
 * distinguishes the three states. `available_from` appends the optional `date`.
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
 * VerifiedBadge — blue "Verified" soft pill with a `BadgeCheck` icon, or grey
 * "Unverified". The icon backs the colour so verified state reads without
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
 * SeekingTag — low-opacity primary soft pill, used for "seeking sponsor" style
 * marketplace tags (clean Airbnb re-skin: no ink border).
 */
function SeekingTag({ children }: { children: React.ReactNode }) {
  return (
    <Badge className={cn("bg-primary/10 text-primary")}>{children}</Badge>
  )
}

export { LevelChip, AvailabilityBadge, VerifiedBadge, SeekingTag }
