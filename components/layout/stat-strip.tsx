import { cn } from '@/lib/utils'

interface StatStripProps {
  stats: { label: string; value: string }[]
  className?: string
}

/**
 * StatStrip — a row of metric tiles (e.g. dashboard headline numbers).
 * Each tile shows a large value above a muted label. Renders as a semantic list.
 */
export default function StatStrip({ stats, className }: StatStripProps) {
  return (
    <ul
      className={cn(
        'grid grid-cols-2 gap-4 sm:grid-cols-4',
        className,
      )}
    >
      {stats.map((stat) => (
        <li
          key={stat.label}
          className="rounded-[var(--radius)] border bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <p className="font-heading text-large font-semibold text-foreground">
            {stat.value}
          </p>
          <p className="mt-1 text-small text-muted-foreground">{stat.label}</p>
        </li>
      ))}
    </ul>
  )
}
