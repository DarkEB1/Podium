import { UserRoundPlus, Radar, Handshake } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    icon: UserRoundPlus,
    eyebrow: 'Athletes & teams',
    title: 'Build your profile',
    body: 'Add your sport, stats, reach and rates. Show brands exactly why you are worth backing — no agent required.',
  },
  {
    n: '02',
    icon: Radar,
    eyebrow: 'On the marketplace',
    title: 'Get discovered',
    body: 'Sponsors search the marketplace by sport, audience and budget — then land on your profile and reach out.',
  },
  {
    n: '03',
    icon: Handshake,
    eyebrow: 'Deal done',
    title: 'Close the deal',
    body: 'Negotiate terms, e-sign the contract and get paid — all in one place. No middlemen, no gatekeepers.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-16 md:py-24">
        {/* header */}
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          How it works
        </p>
        <h2 className="mt-6 max-w-[18ch] font-heading text-4xl font-extrabold leading-[1.0] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
          From signup to <span className="text-primary">signed deal</span>.
        </h2>
        <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
          Three steps, zero gatekeepers. Just athletes, teams and the brands that back them.
        </p>

        {/* steps */}
        <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
          {STEPS.map(({ n, icon: Icon, eyebrow, title, body }) => (
            <div key={n} className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background text-foreground">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="font-heading text-2xl font-extrabold tracking-tight text-muted-foreground">
                  {n}
                </span>
              </div>

              <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {eyebrow}
              </p>
              <h3 className="mt-2 font-heading text-2xl font-extrabold leading-tight tracking-tight text-foreground">
                {title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
