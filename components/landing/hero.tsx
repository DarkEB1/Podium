import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { ArrowRight, Users, Building2, Banknote, BadgeCheck, Star } from 'lucide-react'

const TRUST = [
  { icon: Users, value: '2,400+', label: 'athletes & teams' },
  { icon: Building2, value: '180+', label: 'brands hiring' },
  { icon: Banknote, value: '£1.2m', label: 'deals matched' },
]

const SPORTS = ['Football', 'Athletics', 'Rugby', 'Netball', 'Cycling', 'Boxing', 'Swimming', 'Hockey', 'Tennis', 'Rowing']

// A small bordered athlete card used in the hero collage.
function MiniCard({
  name, sport, stat, tone, rotate, available,
}: { name: string; sport: string; stat: string; tone: string; rotate: string; available?: boolean }) {
  return (
    <div
      className={`w-full rounded-[10px] border-[1.5px] border-foreground bg-card shadow-[4px_4px_0_rgba(26,26,26,0.92)] ${rotate}`}
    >
      <div className={`relative flex h-24 items-start justify-between rounded-t-[9px] border-b-[1.5px] border-foreground p-2 ${tone}`}>
        {available && (
          <span className="inline-flex items-center gap-1 rounded-md border-[1.5px] border-foreground bg-[#c9f4d8] px-2 py-0.5 text-small font-bold text-[#0f6b38]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0f6b38]" /> Available
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 rounded-md border-[1.5px] border-foreground bg-[#cfe0ff] px-1.5 py-0.5 text-[#143e8f]">
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
    <section className="relative overflow-hidden border-b-[1.5px] border-foreground">
      {/* decorative accent blocks */}
      <div aria-hidden className="pointer-events-none absolute -left-10 top-16 h-28 w-28 rotate-12 rounded-2xl border-[1.5px] border-foreground bg-accent/40" />
      <div aria-hidden className="pointer-events-none absolute right-[-30px] bottom-10 h-20 w-20 -rotate-6 rounded-xl bg-primary/10" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
        {/* left: message */}
        <div className="relative z-10">
          <span className="inline-flex -rotate-2 items-center gap-2 rounded-full border-[1.5px] border-foreground bg-accent px-3 py-1 font-heading text-small font-extrabold shadow-[2px_2px_0_rgba(26,26,26,0.92)]">
            <Star className="h-3.5 w-3.5" strokeWidth={2.5} /> Free for athletes &amp; teams
          </span>

          <h1 className="mt-6 font-heading text-5xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">
            Where athletes meet{' '}
            <span className="relative z-0 inline-block before:absolute before:inset-x-[-4px] before:bottom-1 before:-z-10 before:h-4 before:bg-accent before:content-['']">
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
              <div key={label} className="rounded-[10px] border-[1.5px] border-foreground bg-card p-3 shadow-[3px_3px_0_rgba(26,26,26,0.92)]">
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
              <MiniCard name="Maya Okafor" sport="Sprinting · BUCS" stat="48.2k followers" tone="bg-gradient-to-br from-[#7c8694] to-[#566070]" rotate="-rotate-2" available />
              <MiniCard name="Riverside FC" sport="Football · Semi-Pro" stat="12k fan reach" tone="bg-gradient-to-br from-[#8a7c6b] to-[#5f5648]" rotate="rotate-1" />
            </div>
            <div className="space-y-4">
              <MiniCard name="Leah Daniels" sport="Netball · National" stat="Responds in <2h" tone="bg-gradient-to-br from-[#6b7c84] to-[#48565f]" rotate="rotate-2" available />
              <MiniCard name="Tom Reyes" sport="Cycling · Elite" stat="31k followers" tone="bg-gradient-to-br from-[#84766b] to-[#5f5248]" rotate="-rotate-1" />
            </div>
          </div>
        </div>
      </div>

      {/* sports marquee */}
      <div className="border-t-[1.5px] border-foreground bg-card py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-2 px-6 font-heading text-small font-bold uppercase tracking-wide text-muted-foreground">
          {SPORTS.map((s) => (
            <span key={s} className="whitespace-nowrap">{s}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
