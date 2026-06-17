import Link from 'next/link'
import { Trophy, Shield, Building2, Users, ArrowRight, Check, type LucideIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Panel = {
  role: string
  icon: LucideIcon
  tagline: string
  points: string[]
  cta: string
  href: string
  free?: boolean
}

const panels: Panel[] = [
  {
    role: 'Athletes',
    icon: Trophy,
    tagline: 'Get discovered. Close deals. Keep every penny.',
    points: ['Rich profile with stats, media & socials', 'Browse brand campaigns and pitch direct', 'E-sign contracts and get paid'],
    cta: 'Create Athlete Profile',
    href: '/auth/signup',
    free: true,
  },
  {
    role: 'Teams',
    icon: Shield,
    tagline: 'Turn your fanbase into your next sponsor.',
    points: ['Showcase your reach and your roster', 'Match with sponsors that fit your club', 'Negotiate and sign deals in-app'],
    cta: 'List Your Team',
    href: '/auth/signup',
    free: true,
  },
  {
    role: 'Brands',
    icon: Building2,
    tagline: 'Reach elite talent at scale — no agency markup.',
    points: ['Powerful search across verified talent', 'Run campaigns, proposals & contracts', '7-day free trial, then simple tiers'],
    cta: 'Start Finding Talent',
    href: '/auth/signup',
  },
  {
    role: 'Agents',
    icon: Users,
    tagline: 'Manage your whole roster from one dashboard.',
    points: ['Represent multiple athletes & teams', 'Track deals and deadlines in one view', 'Close more, chase less'],
    cta: 'Manage Your Roster',
    href: '/auth/signup',
  },
]

export default function RolePanels() {
  return (
    <section id="who" className="relative overflow-hidden border-b border-border bg-muted/30 py-24">
      {/* decorative accent block */}
      <div aria-hidden className="pointer-events-none absolute -right-10 top-20 h-24 w-24 rounded-2xl bg-accent/30 blur-2xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 font-heading text-small font-semibold text-muted-foreground shadow-card">
            One platform, four playbooks
          </span>
          <h2 className="mt-6 font-heading text-4xl font-extrabold tracking-tight md:text-5xl">
            Built for everyone in <span className="text-primary">the game</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-medium leading-relaxed text-muted-foreground">
            Whichever side of the deal you&apos;re on, Podium gets you there faster.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {panels.map(({ role, icon: Icon, tagline, points, cta, href, free }) => (
            <div
              key={role}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/40 text-accent-foreground">
                  <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                </span>
                {free && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-small font-semibold text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Free forever
                  </span>
                )}
              </div>

              <h3 className="mt-5 font-heading text-2xl font-extrabold tracking-tight">{role}</h3>
              <p className="mt-1.5 text-medium font-medium text-muted-foreground">{tagline}</p>

              <ul className="mt-5 space-y-2.5 text-small">
                {points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/40 text-accent-foreground">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="leading-snug">{pt}</span>
                  </li>
                ))}
              </ul>

              <Link href={href} className={cn(buttonVariants({ size: 'lg' }), 'mt-7')}>
                {cta} <ArrowRight className="ml-1 h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
