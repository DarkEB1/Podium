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
  available?: boolean
  verified?: boolean
}

const CARDS: Card[] = [
  {
    name: 'Maya Okafor',
    category: 'Sprinting · BUCS Champion',
    stat: '48.2k followers',
    available: true,
    verified: true,
  },
  {
    name: 'Riverside FC',
    category: 'Football · Semi-Pro',
    stat: '12k matchday reach',
    verified: true,
  },
  {
    name: 'Leah Daniels',
    category: 'Netball · National League',
    stat: '27k followers',
    available: true,
  },
  {
    name: 'Tom Reyes',
    category: 'Cycling · Elite Endurance',
    stat: '31k followers',
    verified: true,
  },
  {
    name: 'Aisha Bello',
    category: 'Boxing · Featherweight',
    stat: '63k followers',
    available: true,
    verified: true,
  },
  {
    name: 'Harbour Rowing Club',
    category: 'Rowing · Regional',
    stat: '4.5k followers',
  },
]

// A flat athlete/brand discovery card used in the marketplace preview grid.
function DiscoveryCard({ name, category, stat, available, verified }: Card) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        {available ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Available
          </span>
        ) : (
          <span />
        )}
        {verified && (
          <span className="inline-flex items-center justify-center text-primary">
            <BadgeCheck className="h-5 w-5" strokeWidth={2.25} />
          </span>
        )}
      </div>

      <div className="mt-6 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-extrabold leading-tight text-foreground">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{category}</p>
          <p className="mt-2 text-sm font-medium text-foreground">{stat}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
          View <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  )
}

export default function MarketplacePreview() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-16 md:py-24">
        {/* heading */}
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Live marketplace
          </p>
          <h2 className="mt-6 font-heading text-4xl font-extrabold leading-[1.0] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
            Browse the <span className="text-primary">marketplace</span>.
          </h2>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
            Filter thousands of athletes and teams by sport, budget and location. Spot who&apos;s ready to deal — then reach out direct.
          </p>
        </div>

        {/* search bar mock */}
        <div className="mt-10 flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="text-base text-muted-foreground">Search brands, campaigns, sports…</span>
        </div>

        {/* filter chips */}
        <div className="mt-4 flex flex-wrap gap-2.5">
          {FILTERS.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} /> {label}
            </span>
          ))}
        </div>

        {/* discovery grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <DiscoveryCard key={card.name} {...card} />
          ))}
        </div>
      </div>
    </section>
  )
}
