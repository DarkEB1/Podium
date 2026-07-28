import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

/**
 * 2.2 — lets a brand switch between browsing athletes and browsing teams. The
 * primary nav is capped at four items (the mobile bottom bar), so team discovery
 * is reached from here rather than a fifth nav slot.
 */
export default function DiscoverySwitch({ active }: { active: 'athletes' | 'teams' }) {
  const base =
    'rounded-full px-4 py-1.5 text-medium font-medium transition-colors'
  return (
    <nav aria-label="Discover" className="flex gap-2">
      <Link
        href={ROUTES.brand.discover}
        aria-current={active === 'athletes' ? 'page' : undefined}
        className={cn(
          base,
          active === 'athletes'
            ? 'bg-primary text-primary-foreground'
            : 'border border-border text-muted-foreground hover:text-foreground'
        )}
      >
        Athletes
      </Link>
      <Link
        href={ROUTES.brand.discoverTeams}
        aria-current={active === 'teams' ? 'page' : undefined}
        className={cn(
          base,
          active === 'teams'
            ? 'bg-primary text-primary-foreground'
            : 'border border-border text-muted-foreground hover:text-foreground'
        )}
      >
        Teams
      </Link>
    </nav>
  )
}
