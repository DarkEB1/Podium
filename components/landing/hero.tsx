import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

/**
 * M-2: this strip used to display fabricated metrics ("2,400+ athletes",
 * "180+ brands hiring", "£1.2m deals matched") on a pre-launch product with no
 * users. Presenting invented figures as fact is a misleading commercial
 * practice under the CPRs, not merely optimistic marketing copy.
 *
 * Replaced with statements that are true today and verifiable from the
 * product itself. When real platform figures exist, source them from the
 * database rather than hardcoding them here again.
 */
const PROPOSITION = [
  { value: 'Free', label: 'for athletes and teams, always' },
  { value: 'Direct', label: 'no agents, no gatekeepers' },
  { value: 'End-to-end', label: 'discovery to signed contract' },
  { value: 'UK-built', label: 'made for UK sport' },
]

export default function Hero() {
  return (
    <section className="bg-background">
      {/* minimal top nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <span className="font-heading text-xl font-extrabold tracking-tight text-foreground">Podium</span>
        {/* B-7/B-10: every destination here is public — nothing bounces a
            signed-out visitor into the auth wall. */}
        <div className="flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <Link href={ROUTES.landing.howItWorks} className="hidden transition-colors hover:text-foreground sm:inline">How it works</Link>
          <Link href={ROUTES.pricing} className="hidden transition-colors hover:text-foreground sm:inline">Pricing</Link>
          {/* M-5/PR-10: a clear way back in for returning users. */}
          <Link href={ROUTES.auth.signIn} className="transition-colors hover:text-foreground">Sign in</Link>
          <Link href={ROUTES.auth.signUpAs('athlete')} className={buttonVariants({ size: 'sm' })}>List your profile</Link>
        </div>
      </nav>

      {/* big-type statement */}
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:px-10 md:pt-28 md:pb-32">
        <p className="mb-7 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          The sports sponsorship marketplace
        </p>
        <h1 className="max-w-[15ch] font-heading text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-6xl md:text-7xl lg:text-[5.5rem]">
          Where athletes meet <span className="text-primary">the brands</span> that back them.
        </h1>
        <p className="mt-8 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
          List your profile, get discovered, and close deals. No agents, no gatekeepers.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* M-3: the two CTAs diverge by audience instead of both landing on
              the same generic signup. */}
          <Link href={ROUTES.auth.signUpAs('athlete')} className={buttonVariants({ size: 'lg' })}>
            List your profile
          </Link>
          <Link
            href={ROUTES.auth.signUpAs('brand')}
            className={buttonVariants({ size: 'lg', variant: 'outline' })}
          >
            Find talent
          </Link>
        </div>
      </div>

      {/* quiet stat strip */}
      <div className="border-t border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 md:grid-cols-4 md:px-10">
          {PROPOSITION.map(({ value, label }) => (
            <div key={label} className="py-7 md:py-9">
              <p className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
