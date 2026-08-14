import Link from 'next/link'
import { Lock } from 'lucide-react'
import { AccentHeading } from '@/components/ui/accent-heading'
import { Icon } from '@/components/ui/icon'
import { buttonVariants } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

/**
 * AnalyticsLocked — upsell state shown in place of the analytics dashboard
 * for any brand that isn't on an active/trialing Enterprise subscription.
 */
export function AnalyticsLocked() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-16 md:py-16">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm md:p-12">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon icon={Lock} size={28} />
        </div>
        <AccentHeading as="h1" className="justify-center text-large">
          Analytics is an Enterprise feature
        </AccentHeading>
        <p className="mx-auto mt-3 max-w-[52ch] text-medium text-muted-foreground">
          Upgrade to Enterprise to see your outreach funnel, acceptance and response rates,
          audience reach, and daily trends for every campaign.
        </p>
        <Link
          href={ROUTES.brand.subscription}
          className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}
        >
          Upgrade to Enterprise
        </Link>
      </div>
    </div>
  )
}
