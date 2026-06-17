import { Search, BadgeCheck, MapPin, Trophy, Wallet, ShieldCheck, ArrowRight } from 'lucide-react'

const FILTERS = [
  { label: 'Sport', icon: Trophy },
  { label: 'Budget', icon: Wallet },
  { label: 'Location', icon: MapPin },
  { label: 'Verified', icon: ShieldCheck },
]

type Card = {
  name: string
  category: string
  stat: string
  tone: string
  available?: boolean
  verified?: boolean
}

const CARDS: Card[] = [
  {
    name: 'Maya Okafor',
    category: 'Sprinting · BUCS Champion',
    stat: '48.2k followers',
    tone: 'bg-gradient-to-br from-[#7c8694] to-[#566070]',
    available: true,
    verified: true,
  },
  {
    name: 'Riverside FC',
    category: 'Football · Semi-Pro',
    stat: '12k matchday reach',
    tone: 'bg-gradient-to-br from-[#8a7c6b] to-[#5f5648]',
    verified: true,
  },
  {
    name: 'Leah Daniels',
    category: 'Netball · National League',
    stat: '27k followers',
    tone: 'bg-gradient-to-br from-[#6b7c84] to-[#48565f]',
    available: true,
  },
  {
    name: 'Tom Reyes',
    category: 'Cycling · Elite Endurance',
    stat: '31k followers',
    tone: 'bg-gradient-to-br from-[#84766b] to-[#5f5248]',
    verified: true,
  },
  {
    name: 'Aisha Bello',
    category: 'Boxing · Featherweight',
    stat: '63k followers',
    tone: 'bg-gradient-to-br from-[#7c7484] to-[#52495f]',
    available: true,
    verified: true,
  },
  {
    name: 'Harbour Rowing Club',
    category: 'Rowing · Regional',
    stat: '4.5k followers',
    tone: 'bg-gradient-to-br from-[#6b8480] to-[#485f5b]',
  },
]

// A rich athlete/brand discovery card used in the marketplace preview grid.
function DiscoveryCard({ name, category, stat, tone, available, verified }: Card) {
  return (
    <div className="liftable group overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* image area */}
      <div className={`relative flex h-36 items-start justify-between p-3 ${tone}`}>
        {available && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-small font-semibold text-success shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Available
          </span>
        )}
        {verified && (
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-white/95 p-1.5 text-primary shadow-sm">
            <BadgeCheck className="h-4 w-4" strokeWidth={2.25} />
          </span>
        )}
      </div>
      {/* details */}
      <div className="flex items-end justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate font-heading text-medium font-extrabold leading-tight">{name}</p>
          <p className="truncate text-small text-muted-foreground">{category}</p>
          <p className="mt-2 text-small font-medium">{stat}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-3.5 py-1.5 font-heading text-small font-bold text-accent-foreground shadow-sm transition-transform duration-150 group-hover:translate-x-0.5">
          View <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  )
}

export default function MarketplacePreview() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      {/* decorative accent block — flat, upright, soft */}
      <div aria-hidden className="pointer-events-none absolute -right-12 top-24 h-28 w-28 rounded-3xl bg-accent/20 blur-2xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* heading */}
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-accent/15 px-3.5 py-1.5 font-heading text-small font-semibold text-foreground">
            <Search className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} /> Live marketplace
          </span>
          <h2 className="mt-6 font-heading text-4xl font-extrabold leading-[1.04] tracking-tight md:text-5xl">
            Browse the{' '}
            <span className="relative z-0 inline-block before:absolute before:inset-x-[-4px] before:bottom-1 before:-z-10 before:h-3 before:rounded-full before:bg-accent/35 before:content-['']">
              marketplace
            </span>
          </h2>
          <p className="mt-5 text-medium leading-relaxed text-muted-foreground md:text-lg">
            Filter thousands of athletes and teams by sport, budget and location. Spot who&apos;s ready to deal — then reach out direct.
          </p>
        </div>

        {/* search bar mock */}
        <div className="mt-10 flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3.5 shadow-card">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="text-medium text-muted-foreground">Search brands, campaigns, sports…</span>
        </div>

        {/* filter chips */}
        <div className="mt-4 flex flex-wrap gap-2.5">
          {FILTERS.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 font-heading text-small font-semibold text-foreground shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} /> {label}
            </span>
          ))}
        </div>

        {/* discovery grid */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <DiscoveryCard key={card.name} {...card} />
          ))}
        </div>
      </div>
    </section>
  )
}
