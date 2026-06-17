import type { LucideIcon } from 'lucide-react'
import { Icon } from '@/components/ui/icon'
import { iconMap, type IconConcept } from '@/lib/copy/icon-map'
import { cn } from '@/lib/utils'

interface Stat {
  label: string
  value: string
  /** Pass a Lucide icon component directly... */
  icon?: LucideIcon
  /** ...or reference one of the shared icon-map concepts. */
  iconKey?: IconConcept
}

interface StatStripProps {
  stats: Stat[]
  className?: string
}

/**
 * StatStrip — a row of metric tiles (e.g. dashboard headline numbers).
 * Each tile is a bordered card (ink border + hard shadow) showing a large
 * value above a muted label, with an optional Lucide icon for the metric.
 * The icon is decorative (aria-hidden); the label remains the visible,
 * accessible text. Renders as a semantic list.
 */
export default function StatStrip({ stats, className }: StatStripProps) {
  return (
    <ul
      className={cn(
        'grid grid-cols-2 gap-4 sm:grid-cols-4',
        className,
      )}
    >
      {stats.map((stat) => {
        const StatIcon = stat.icon ?? (stat.iconKey ? iconMap[stat.iconKey] : undefined)
        return (
          <li
            key={stat.label}
            className="rounded-[var(--radius)] border-[length:--border-ink-width] border-border-ink bg-card p-4 shadow-[var(--shadow-card)]"
          >
            {StatIcon ? (
              <Icon icon={StatIcon} className="mb-2 text-muted-foreground" />
            ) : null}
            <p className="font-heading text-large font-semibold text-foreground">
              {stat.value}
            </p>
            <p className="mt-1 text-small text-muted-foreground">{stat.label}</p>
          </li>
        )
      })}
    </ul>
  )
}
