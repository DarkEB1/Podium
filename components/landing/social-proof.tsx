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
    tone: 'bg-accent',
    rotate: '-rotate-1',
  },
  {
    quote: 'We found four semi-pro clubs that fit our budget in an afternoon. The match scores were scarily accurate.',
    name: 'Daniel R.',
    role: 'Brand Lead · Velocity Sportswear',
    tone: 'bg-card',
    rotate: 'rotate-1',
  },
  {
    quote: 'Podium got our whole netball squad in front of regional sponsors. Two signed before the season even kicked off.',
    name: 'Leah D.',
    role: 'Captain · National League',
    tone: 'bg-card',
    rotate: '-rotate-1',
  },
]

export default function SocialProof() {
  return (
    <section id="about" className="relative overflow-hidden border-b-[1.5px] border-foreground py-20 md:py-24">
      {/* decorative accent blocks */}
      <div aria-hidden className="pointer-events-none absolute -right-12 top-10 h-24 w-24 rotate-12 rounded-2xl border-[1.5px] border-foreground bg-accent/40" />
      <div aria-hidden className="pointer-events-none absolute left-[-28px] bottom-16 h-20 w-20 -rotate-6 rounded-xl bg-primary/10" />

      <div className="mx-auto max-w-6xl px-6">
        {/* heading */}
        <div className="relative z-10 text-center">
          <span className="inline-flex rotate-2 items-center gap-2 rounded-full border-[1.5px] border-foreground bg-accent px-3 py-1 font-heading text-small font-extrabold shadow-[2px_2px_0_rgba(26,26,26,0.92)]">
            Real deals, real fast
          </span>
          <h2 className="mx-auto mt-6 max-w-2xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            Talent&apos;s already{' '}
            <span className="relative z-0 inline-block before:absolute before:inset-x-[-4px] before:bottom-1 before:-z-10 before:h-4 before:bg-accent before:content-['']">
              winning
            </span>{' '}
            here
          </h2>
        </div>

        {/* stat band */}
        <div className="relative z-10 mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-[10px] border-[1.5px] border-foreground bg-card p-5 shadow-[3px_3px_0_rgba(26,26,26,0.92)]"
            >
              <span className="inline-flex rounded-md border-[1.5px] border-foreground bg-accent p-1.5">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <p className="mt-3 font-heading text-3xl font-extrabold leading-none tracking-tight md:text-4xl">
                {value}
              </p>
              <p className="mt-1.5 text-small text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* testimonials */}
        <div className="relative z-10 mt-14 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, role, tone, rotate }) => (
            <figure
              key={name}
              className={`flex flex-col rounded-[10px] border-[1.5px] border-foreground p-6 shadow-[3px_3px_0_rgba(26,26,26,0.92)] ${tone} ${rotate}`}
            >
              <span className="inline-flex w-fit rounded-md border-[1.5px] border-foreground bg-background p-1.5">
                <Quote className="h-4 w-4" strokeWidth={2} />
              </span>
              <blockquote className="mt-4 text-medium font-medium leading-relaxed">
                &ldquo;{quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-1 border-t-[1.5px] border-foreground pt-3 font-heading text-small font-bold">
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
