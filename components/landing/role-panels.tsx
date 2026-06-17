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
    <section id="who" className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-16 md:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            One platform, four playbooks
          </p>
          <h2 className="mt-6 font-heading text-4xl font-extrabold leading-[1.0] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
            Built for everyone in <span className="text-primary">the game</span>.
          </h2>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
            Whichever side of the deal you&apos;re on, Podium gets you there faster.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {panels.map(({ role, icon: Icon, tagline, points, cta, href, free }) => (
            <div
              key={role}
              className="flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background text-foreground">
                  <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                </span>
                {free && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Free forever
                  </span>
                )}
              </div>

              <h3 className="mt-6 font-heading text-2xl font-extrabold tracking-tight text-foreground">{role}</h3>
              <p className="mt-2 text-base font-medium text-muted-foreground">{tagline}</p>

              <ul className="mt-6 space-y-3 text-sm">
                {points.map((pt) => (
                  <li key={pt} className="flex items-start gap-3 text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" />
                    <span className="leading-snug">{pt}</span>
                  </li>
                ))}
              </ul>

              <Link href={href} className={cn(buttonVariants({ size: 'lg' }), 'mt-8')}>
                {cta} <ArrowRight className="ml-1 h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
