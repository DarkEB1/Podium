import Link from 'next/link'
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
  /**
   * Optional link target: the value renders as a Link (e.g. an owner-facing
   * "Add socials" call to action standing in for a missing metric).
   */
  href?: string
  /** Small muted caption rendered under the value (e.g. "Self-reported"). */
  caption?: string
  /**
   * Screen-reader text replacing a purely visual value (e.g. a dash) so the
   * tile still announces something meaningful.
   */
  srValue?: string
}

interface StatStripProps {
  stats: Stat[]
  className?: string
}

/** Threshold above which a value steps down from the display size. */
const LONG_VALUE_CHARS = 12

/**
 * StatStrip — a row of metric tiles (e.g. dashboard headline numbers).
 * Each tile is a clean, light card (single soft border + gentle shadow)
 * showing a large value above a muted label, with an optional Lucide icon
 * for the metric. Hovering lifts the tile slightly; motion is suppressed
 * under prefers-reduced-motion. The icon is decorative (aria-hidden); the
 * label remains the visible, accessible text. Renders as a semantic list.
 *
 * Short values (numbers, "12.4K") get the display size; long strings such as
 * "Semi-Professional" step down to text-large and are allowed to wrap so they
 * never overflow a narrow tile.
 */
export default function StatStrip({ stats, className }: StatStripProps) {
  return (
    <ul
      className={cn(
        'grid grid-cols-2 gap-6 sm:grid-cols-4',
        className,
      )}
    >
      {stats.map((stat) => {
        const StatIcon = stat.icon ?? (stat.iconKey ? iconMap[stat.iconKey] : undefined)
        const long = stat.value.length > LONG_VALUE_CHARS
        // Composed WITHOUT cn/twMerge: tailwind-merge misreads the custom
        // text-large/text-display utilities as colours and would drop them
        // when a text-foreground/text-primary class joins the same merge.
        // Links read as an action, not a metric, so they never take the
        // display size regardless of length.
        const valueClasses = `font-heading font-semibold tracking-tight ${
          long || stat.href
            ? 'break-words text-large leading-snug hyphens-auto'
            : 'text-display leading-none'
        }`
        const valueContent = stat.srValue ? (
          <>
            <span aria-hidden="true">{stat.value}</span>
            <span className="sr-only">{stat.srValue}</span>
          </>
        ) : (
          stat.value
        )
        return (
          <li
            key={stat.label}
            className={cn(
              'rounded-2xl border border-border bg-card p-5 sm:p-8',
              'shadow-sm transition-[transform,box-shadow] duration-200 ease-out',
              'hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99]',
              'motion-reduce:transform-none motion-reduce:transition-none',
            )}
          >
            {StatIcon ? (
              <Icon icon={StatIcon} className="mb-4 text-muted-foreground" />
            ) : null}
            {stat.href ? (
              <Link
                href={stat.href}
                className={`${valueClasses} block text-primary underline-offset-4 hover:underline`}
              >
                {valueContent}
              </Link>
            ) : (
              <p className={`${valueClasses} text-foreground`}>{valueContent}</p>
            )}
            {stat.caption ? (
              <p className="mt-1 text-small text-muted-foreground">{stat.caption}</p>
            ) : null}
            <p className={cn('text-small text-muted-foreground', stat.caption ? 'mt-1' : 'mt-3')}>
              {stat.label}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
