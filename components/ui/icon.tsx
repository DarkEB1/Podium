import type { LucideIcon } from "lucide-react"

export function Icon({
  icon: I,
  size = 20,
  className,
}: {
  icon: LucideIcon
  size?: number
  className?: string
}) {
  return <I size={size} strokeWidth={2} className={className} aria-hidden="true" />
}
