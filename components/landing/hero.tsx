import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { ArrowRight, Users, Building2, Banknote, BadgeCheck, Star } from 'lucide-react'

const TRUST = [
  { icon: Users, value: '2,400+', label: 'athletes & teams' },
  { icon: Building2, value: '180+', label: 'brands hiring' },
  { icon: Banknote, value: '£1.2m', label: 'deals matched' },
]

const SPORTS = ['Football', 'Athletics', 'Rugby', 'Netball', 'Cycling', 'Boxing', 'Swimming', 'Hockey', 'Tennis', 'Rowing']

// A clean athlete card used in the hero collage.
function MiniCard({
  name, sport, stat, tone, available,
}: { name: string; sport: string; stat: string; tone: string; rotate: string; available?: boolean }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-lg motion-reduce:transition-none">
      <div className={`relative flex h-24 items-start justify-between p-2 ${tone}`}>
        {available && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f8ef] px-2 py-0.5 text-small font-semibold text-[#0f6b38]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0f6b38]" /> Available
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/85 px-1.5 py-0.5 text-[#143e8f]">
          <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
      <div className="p-3">
        <p className="font-heading text-medium font-bold leading-tight">{name}</p>
        <p className="text-small text-muted-foreground">{sport}</p>
        <p className="mt-2 text-small font-medium">{stat}</p>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* decorative accent blocks */}
      <div aria-hidden className="pointer-events-none absolute -left-10 top-16 h-28 w-28 rounded-2xl bg-accent/30 blur-[2px]" />
      <div aria-hidden className="pointer-events-none absolute right-[-30px] bottom-10 h-20 w-20 rounded-2xl bg-primary/10" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
        {/* left: message */}
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-accent/10 px-3 py-1 font-heading text-small font-bold text-accent-foreground">
            <Star className="h-3.5 w-3.5 text-accent-foreground" strokeWidth={2.5} /> Free for athletes &amp; teams
          </span>

          <h1 className="mt-6 font-heading text-5xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">
            Where athletes meet{' '}
            <span className="relative z-0 inline-block before:absolute before:inset-x-[-4px] before:bottom-1 before:-z-10 before:h-3 before:rounded-sm before:bg-accent/40 before:content-['']">
              the brands
            </span>{' '}
            that back them
          </h1>

          <p className="mt-5 max-w-md text-medium leading-relaxed text-muted-foreground md:text-lg">
            The sports sponsorship marketplace. List your profile, get discovered, and close deals — no agents, no gatekeepers.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/signup" className={buttonVariants({ size: 'lg' })}>
              List your profile <ArrowRight className="ml-1 h-4 w-4" strokeWidth={2.5} />
            </Link>
            <Link href="/auth/signup" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
              Find talent
            </Link>
          </div>

          {/* trust row */}
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {TRUST.map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-card p-3 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none"
              >
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                <p className="mt-1.5 font-heading text-lg font-extrabold leading-none">{value}</p>
                <p className="text-small text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* right: card collage */}
        <div className="relative z-10 hidden md:block">
          <div className="grid grid-cols-2 gap-4">
            <div className="mt-8 space-y-4">
              <MiniCard name="Maya Okafor" sport="Sprinting · BUCS" stat="48.2k followers" tone="bg-gradient-to-br from-[#7c8694] to-[#566070]" rotate="" available />
              <MiniCard name="Riverside FC" sport="Football · Semi-Pro" stat="12k fan reach" tone="bg-gradient-to-br from-[#8a7c6b] to-[#5f5648]" rotate="" />
            </div>
            <div className="space-y-4">
              <MiniCard name="Leah Daniels" sport="Netball · National" stat="Responds in <2h" tone="bg-gradient-to-br from-[#6b7c84] to-[#48565f]" rotate="" available />
              <MiniCard name="Tom Reyes" sport="Cycling · Elite" stat="31k followers" tone="bg-gradient-to-br from-[#84766b] to-[#5f5248]" rotate="" />
            </div>
          </div>
        </div>
      </div>

      {/* sports marquee */}
      <div className="border-t border-border bg-muted/30 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-2 px-6 font-heading text-small font-bold uppercase tracking-wide text-muted-foreground">
          {SPORTS.map((s) => (
            <span key={s} className="whitespace-nowrap">{s}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
