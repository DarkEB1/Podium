import { Users, Building2, Banknote, Zap, Quote } from 'lucide-react'

const STATS = [
  { icon: Users, value: '2,400+', label: 'athletes & teams' },
  { icon: Building2, value: '180+', label: 'brands hiring' },
  { icon: Banknote, value: '£1.2m', label: 'deals matched' },
  { icon: Zap, value: '92%', label: 'matched in 48h' },
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
    <section id="about" className="relative overflow-hidden border-b border-border py-20 md:py-24">
      {/* decorative accent blocks */}
      <div aria-hidden className="pointer-events-none absolute -right-12 top-10 h-24 w-24 rounded-2xl bg-accent/30" />
      <div aria-hidden className="pointer-events-none absolute left-[-28px] bottom-16 h-20 w-20 rounded-2xl bg-primary/10" />

      <div className="mx-auto max-w-6xl px-6">
        {/* heading */}
        <div className="relative z-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 font-heading text-small font-bold text-accent-foreground">
            Real deals, real fast
          </span>
          <h2 className="mx-auto mt-6 max-w-2xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            Talent&apos;s already{' '}
            <span className="relative z-0 inline-block before:absolute before:inset-x-[-4px] before:bottom-1 before:-z-10 before:h-4 before:bg-accent/40 before:content-['']">
              winning
            </span>{' '}
            here
          </h2>
        </div>

        {/* stat band */}
        <div className="relative z-10 mt-12 grid grid-cols-2 gap-5 md:grid-cols-4">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span className="inline-flex rounded-xl bg-accent/15 p-2 text-accent-foreground">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <p className="mt-4 font-heading text-3xl font-extrabold leading-none tracking-tight md:text-4xl">
                {value}
              </p>
              <p className="mt-2 text-small text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* testimonials */}
        <div className="relative z-10 mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, role }) => (
            <figure
              key={name}
              className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span className="inline-flex w-fit rounded-xl bg-accent/15 p-2 text-accent-foreground">
                <Quote className="h-4 w-4" strokeWidth={2} />
              </span>
              <blockquote className="mt-5 text-medium font-medium leading-relaxed">
                &ldquo;{quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-1 border-t border-border pt-4 font-heading text-small font-bold">
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
