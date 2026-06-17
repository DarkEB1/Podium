import { UserRoundPlus, Radar, Handshake, ArrowRight, Zap } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    icon: UserRoundPlus,
    eyebrow: 'Athletes & teams',
    title: 'Build your profile',
    lead: 'List for free in minutes.',
    body: 'Add your sport, stats, reach and rates. Show brands exactly why you are worth backing — no agent required.',
    tone: 'bg-accent text-accent-foreground',
  },
  {
    n: '02',
    icon: Radar,
    eyebrow: 'On the marketplace',
    title: 'Get discovered',
    lead: 'Brands come to you.',
    body: 'Sponsors search the marketplace by sport, audience and budget — then land on your profile and reach out.',
    tone: 'bg-primary text-primary-foreground',
  },
  {
    n: '03',
    icon: Handshake,
    eyebrow: 'Deal done',
    title: 'Close the deal',
    lead: 'Message, agree, get paid.',
    body: 'Negotiate terms, e-sign the contract and get paid — all in one place. No middlemen, no gatekeepers.',
    tone: 'bg-success text-white',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-muted/30">
      {/* decorative accent blocks — flat, upright, soft */}
      <div aria-hidden className="pointer-events-none absolute -right-10 top-12 h-24 w-24 rounded-3xl bg-accent/20 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute left-[-24px] bottom-14 h-16 w-16 rounded-2xl bg-primary/10 blur-xl" />

      <div className="mx-auto max-w-6xl px-6 py-24">
        {/* header */}
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-accent/15 px-3.5 py-1.5 font-heading text-small font-semibold text-foreground">
            <Zap className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} /> Three steps, zero gatekeepers
          </span>

          <h2 className="mt-6 max-w-2xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            How Podium{' '}
            <span className="relative z-0 inline-block before:absolute before:inset-x-[-4px] before:bottom-1 before:-z-10 before:h-3 before:rounded-full before:bg-accent/35 before:content-['']">
              works
            </span>
          </h2>

          <p className="mt-5 max-w-md text-medium leading-relaxed text-muted-foreground md:text-lg">
            From signup to signed deal — no agents, no waiting rooms. Just athletes, teams and the brands that back them.
          </p>
        </div>

        {/* steps */}
        <div className="relative mt-16 grid gap-8 md:grid-cols-3 md:gap-6">
          {/* dashed connector across the row (desktop only) */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[60px] hidden border-t border-dashed border-border md:block"
          />

          {STEPS.map(({ n, icon: Icon, eyebrow, title, lead, body, tone }, i) => (
            <div key={n} className="relative">
              <div className="liftable relative h-full rounded-2xl border border-border bg-card p-7 pt-11 shadow-card">
                {/* numbered badge — clean, upright, soft */}
                <span
                  className={`absolute -top-5 left-7 inline-flex h-11 w-11 items-center justify-center rounded-full font-heading text-base font-extrabold shadow-card ${tone}`}
                >
                  {n}
                </span>

                {/* icon tile */}
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-sm">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>

                <p className="mt-5 font-heading text-small font-semibold uppercase tracking-wide text-muted-foreground">
                  {eyebrow}
                </p>
                <h3 className="mt-1 font-heading text-2xl font-extrabold leading-tight tracking-tight">
                  {title}
                </h3>
                <p className="mt-2 font-heading text-medium font-bold">{lead}</p>
                <p className="mt-2 text-medium leading-relaxed text-muted-foreground">{body}</p>
              </div>

              {/* arrow between steps (desktop only) */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-3 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm md:inline-flex"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
