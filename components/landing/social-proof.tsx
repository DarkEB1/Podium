const STATS = [
  { value: '2,400+', label: 'athletes & teams' },
  { value: '180+', label: 'brands hiring' },
  { value: '£1.2m', label: 'deals matched' },
  { value: '92%', label: 'matched in 48h' },
]

const TESTIMONIALS = [
  {
    quote: 'Signed my first kit deal three weeks after listing. No agent, no waiting around — a brand just slid into my inbox.',
    name: 'Maya O.',
    role: 'Sprinter · BUCS',
  },
  {
    quote: 'We found four semi-pro clubs that fit our budget in an afternoon. The match scores were scarily accurate.',
    name: 'Daniel R.',
    role: 'Brand Lead · Velocity Sportswear',
  },
  {
    quote: 'Podium got our whole netball squad in front of regional sponsors. Two signed before the season even kicked off.',
    name: 'Leah D.',
    role: 'Captain · National League',
  },
]

export default function SocialProof() {
  return (
    <section id="about" className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-16 md:py-24">
        {/* heading */}
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Real deals, real fast
          </p>
          <h2 className="mt-6 font-heading text-4xl font-extrabold leading-[1.0] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
            Talent&apos;s already <span className="text-primary">winning</span> here.
          </h2>
        </div>

        {/* stat band */}
        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {STATS.map(({ value, label }) => (
            <div key={label} className="bg-card p-8">
              <p className="font-heading text-3xl font-extrabold leading-none tracking-tight text-foreground md:text-4xl">
                {value}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* testimonials */}
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, role }) => (
            <figure
              key={name}
              className="flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm"
            >
              <blockquote className="text-base font-medium leading-relaxed text-foreground">
                &ldquo;{quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-1 border-t border-border pt-5 font-heading text-sm font-bold text-foreground">
                {name}
                <span className="font-normal text-muted-foreground">· {role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
