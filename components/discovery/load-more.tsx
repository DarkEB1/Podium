import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  /** Href that renders the next page (e.g. `/athlete/discover?show=48`). */
  href: string
  /** How many rows are on screen right now — stated so truncation is never silent. */
  shown: number
  label?: string
}

/**
 * LoadMore — FA-5. The visible affordance for a bounded feed.
 *
 * A plain `Link` styled with `buttonVariants`: Button is @base-ui/react and has
 * no `asChild`, so a Link must carry the classes itself (CLAUDE.md).
 */
export default function LoadMore({ href, shown, label = 'Load more' }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 pt-2" data-testid="load-more">
      <p className="text-small text-muted-foreground">Showing the first {shown}</p>
      <Link href={href} scroll={false} className={cn(buttonVariants({ variant: 'outline' }))}>
        {label}
      </Link>
    </div>
  )
}
