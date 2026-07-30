import Link from 'next/link'
import { Check } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import Footer from '@/components/layout/footer'

export const metadata = {
  title: 'Pricing · Podium',
  description:
    'Free forever for athletes, teams and agents. Simple monthly tiers for brands.',
}

/**
 * B-7 / B-10 — the landing nav's "Pricing" link used to point at
 * `/brand/subscription`, which is behind the auth wall, so signed-out visitors
 * were bounced to sign-in. This is the public marketing equivalent; the
 * in-app checkout still lives at `/brand/subscription`.
 *
 * Tier names, prices and limits mirror `components/brand/subscription-tiers.tsx`.
 */
const FREE_ROLES = [
  {
    role: 'Athletes',
    blurb: 'List your profile, message brands, sign contracts and get paid, with no fees, ever.',
    href: ROUTES.auth.signUpAs('athlete'),
    cta: 'Create your profile',
  },
  {
    role: 'Teams',
    blurb: 'Showcase your reach and roster, and match with sponsors that fit your club.',
    href: ROUTES.auth.signUpAs('team'),
    cta: 'List your team',
  },
  {
    role: 'Agents',
    blurb: 'Represent athletes and teams, and run your whole roster from one dashboard.',
    href: ROUTES.auth.signUpAs('agent'),
    cta: 'Manage your roster',
  },
]

const BRAND_TIERS = [
  {
    name: 'Tier 1',
    price: '£99',
    cadence: '/mo',
    tagline: 'For brands getting started with athlete partnerships.',
    features: ['50 connection requests / month', 'Basic search filters', '10 athlete messages / month'],
  },
  {
    name: 'Tier 2',
    price: '£249',
    cadence: '/mo',
    tagline: 'For growing brands running multiple campaigns.',
    popular: true,
    features: [
      '200 connection requests / month',
      'Advanced search filters',
      'Unlimited athlete messaging',
      'Priority support',
    ],
  },
  {
    name: 'Tier 3',
    price: '£599',
    cadence: '/mo',
    tagline: 'For agencies and enterprises at scale.',
    features: [
      'Unlimited connection requests',
      'Full filter suite',
      'Unlimited athlete messaging',
      'Dedicated account manager',
      'Analytics dashboard',
    ],
  },
]

export default function PricingPage() {
  return (
    <main>
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:px-16 md:pt-24">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pricing
          </p>
          <h1 className="mt-6 max-w-[18ch] font-heading text-4xl font-extrabold leading-[1.0] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
            Free for talent. <span className="text-primary">Simple</span> for brands.
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
            Athletes, teams and agents never pay a penny. Brands cover the cost of the
            marketplace with a straightforward monthly subscription.
          </p>
        </div>
      </section>

      <section aria-labelledby="free-heading" className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-16">
          <h2 id="free-heading" className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
            Free forever
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {FREE_ROLES.map(({ role, blurb, href, cta }) => (
              <div key={role} className="flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm">
                <span className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" /> £0
                </span>
                <h3 className="mt-5 font-heading text-2xl font-extrabold tracking-tight text-foreground">
                  {role}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{blurb}</p>
                <Link href={href} className={cn(buttonVariants({ variant: 'outline' }), 'mt-8')}>
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="brands-heading" className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-16">
          <h2 id="brands-heading" className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
            For brands
          </h2>
          <p className="mt-3 max-w-[52ch] text-base text-muted-foreground">
            Every plan starts with a 7-day free trial. Change tier or cancel any time from your
            settings.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {BRAND_TIERS.map(({ name, price, cadence, tagline, features, popular }) => (
              <div
                key={name}
                className={cn(
                  'flex flex-col rounded-2xl border bg-card p-8 shadow-sm',
                  popular ? 'border-primary' : 'border-border',
                )}
              >
                {popular ? (
                  <span className="self-start rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                    Most popular
                  </span>
                ) : null}
                <h3 className="mt-5 font-heading text-2xl font-extrabold tracking-tight text-foreground">
                  {name}
                </h3>
                <p className="mt-3">
                  <span className="font-heading text-4xl font-extrabold tracking-tight text-foreground">
                    {price}
                  </span>
                  <span className="text-base text-muted-foreground">{cadence}</span>
                </p>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{tagline}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" />
                      <span className="leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={ROUTES.auth.signUpAs('brand')}
                  className={cn(buttonVariants({ variant: popular ? 'default' : 'outline' }), 'mt-8')}
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
