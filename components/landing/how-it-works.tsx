import { UserRoundPlus, Radar, Handshake, ArrowRight, Zap } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    icon: UserRoundPlus,
    eyebrow: 'Athletes & teams',
    title: 'Build your profile',
    lead: 'List for free in minutes.',
    body: 'Add your sport, stats, reach and rates. Show brands exactly why you are worth backing — no agent required.',
    rotate: '-rotate-3',
    tone: 'bg-accent',
  },
  {
    n: '02',
    icon: Radar,
    eyebrow: 'On the marketplace',
    title: 'Get discovered',
    lead: 'Brands come to you.',
    body: 'Sponsors search the marketplace by sport, audience and budget — then land on your profile and reach out.',
    rotate: 'rotate-2',
    tone: 'bg-primary text-primary-foreground',
  },
  {
    n: '03',
    icon: Handshake,
    eyebrow: 'Deal done',
    title: 'Close the deal',
    lead: 'Message, agree, get paid.',
    body: 'Negotiate terms, e-sign the contract and get paid — all in one place. No middlemen, no gatekeepers.',
    rotate: '-rotate-2',
    tone: 'bg-success',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden border-b-[1.5px] border-foreground bg-muted/30">
      {/* decorative accent blocks */}
      <div aria-hidden className="pointer-events-none absolute -right-10 top-12 h-24 w-24 rotate-12 rounded-2xl border-[1.5px] border-foreground bg-accent/40" />
      <div aria-hidden className="pointer-events-none absolute left-[-24px] bottom-14 h-16 w-16 -rotate-6 rounded-xl bg-primary/10" />

      <div className="mx-auto max-w-6xl px-6 py-24">
        {/* header */}
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex -rotate-2 items-center gap-2 rounded-full border-[1.5px] border-foreground bg-accent px-3 py-1 font-heading text-small font-extrabold shadow-[2px_2px_0_rgba(26,26,26,0.92)]">
            <Zap className="h-3.5 w-3.5" strokeWidth={2.5} /> Three steps, zero gatekeepers
          </span>

          <h2 className="mt-6 max-w-2xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            How Podium{' '}
            <span className="relative z-0 inline-block before:absolute before:inset-x-[-4px] before:bottom-1 before:-z-10 before:h-4 before:bg-accent before:content-['']">
              works
            </span>
          </h2>

          <p className="mt-5 max-w-md text-medium leading-relaxed text-muted-foreground md:text-lg">
            From signup to signed deal — no agents, no waiting rooms. Just athletes, teams and the brands that back them.
          </p>
        </div>

        {/* steps */}
        <div className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
          {/* dashed connector across the row (desktop only) */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[58px] hidden border-t-[1.5px] border-dashed border-foreground/40 md:block"
          />

          {STEPS.map(({ n, icon: Icon, eyebrow, title, lead, body, rotate, tone }, i) => (
            <div key={n} className="relative">
              <div className="relative h-full rounded-[10px] border-[1.5px] border-foreground bg-card p-6 pt-10 shadow-[4px_4px_0_rgba(26,26,26,0.92)]">
                {/* numbered sticker badge */}
                <span
                  className={`absolute -top-5 left-6 inline-flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-foreground font-heading text-lg font-extrabold shadow-[3px_3px_0_rgba(26,26,26,0.92)] ${rotate} ${tone}`}
                >
                  {n}
                </span>

                {/* icon tile */}
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[10px] border-[1.5px] border-foreground bg-background shadow-[2px_2px_0_rgba(26,26,26,0.92)]">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>

                <p className="mt-5 font-heading text-small font-bold uppercase tracking-wide text-muted-foreground">
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
                  className="absolute -right-3 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-foreground bg-accent shadow-[2px_2px_0_rgba(26,26,26,0.92)] md:inline-flex"
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
