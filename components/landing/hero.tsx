import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

const TRUST = [
  { value: '2,400+', label: 'athletes & teams' },
  { value: '180+', label: 'brands hiring' },
  { value: '£1.2m', label: 'deals matched' },
  { value: 'Free', label: 'for athletes' },
]

export default function Hero() {
  return (
    <section className="bg-background">
      {/* minimal top nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <span className="font-heading text-xl font-extrabold tracking-tight text-foreground">Podium</span>
        <div className="flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <Link href="/auth/login" className="hidden transition-colors hover:text-foreground sm:inline">How it works</Link>
          <Link href="/brand/subscription" className="hidden transition-colors hover:text-foreground sm:inline">Pricing</Link>
          <Link href="/auth/signup" className={buttonVariants({ size: 'sm' })}>List your profile</Link>
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
          <Link href="/auth/signup" className={buttonVariants({ size: 'lg' })}>
            List your profile
          </Link>
          <Link href="/auth/signup" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            Find talent
          </Link>
        </div>
      </div>

      {/* quiet stat strip */}
      <div className="border-t border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 md:grid-cols-4 md:px-10">
          {TRUST.map(({ value, label }) => (
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
