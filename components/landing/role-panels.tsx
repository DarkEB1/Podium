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
  rotate: string
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
    rotate: '-rotate-1',
  },
  {
    role: 'Teams',
    icon: Shield,
    tagline: 'Turn your fanbase into your next sponsor.',
    points: ['Showcase your reach and your roster', 'Match with sponsors that fit your club', 'Negotiate and sign deals in-app'],
    cta: 'List Your Team',
    href: '/auth/signup',
    free: true,
    rotate: 'rotate-1',
  },
  {
    role: 'Brands',
    icon: Building2,
    tagline: 'Reach elite talent at scale — no agency markup.',
    points: ['Powerful search across verified talent', 'Run campaigns, proposals & contracts', '7-day free trial, then simple tiers'],
    cta: 'Start Finding Talent',
    href: '/auth/signup',
    rotate: 'rotate-1',
  },
  {
    role: 'Agents',
    icon: Users,
    tagline: 'Manage your whole roster from one dashboard.',
    points: ['Represent multiple athletes & teams', 'Track deals and deadlines in one view', 'Close more, chase less'],
    cta: 'Manage Your Roster',
    href: '/auth/signup',
    rotate: '-rotate-1',
  },
]

export default function RolePanels() {
  return (
    <section id="who" className="relative overflow-hidden border-b-[1.5px] border-foreground bg-muted/30 py-24">
      {/* decorative accent block */}
      <div aria-hidden className="pointer-events-none absolute -right-10 top-20 h-24 w-24 rotate-12 rounded-2xl border-[1.5px] border-foreground bg-accent/40" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <span className="inline-flex -rotate-2 items-center gap-2 rounded-full border-[1.5px] border-foreground bg-accent px-3 py-1 font-heading text-small font-extrabold shadow-[2px_2px_0_rgba(26,26,26,0.92)]">
            One platform, four playbooks
          </span>
          <h2 className="mt-6 font-heading text-4xl font-extrabold tracking-tight md:text-5xl">
            Built for everyone in{' '}
            <span className="relative z-0 inline-block before:absolute before:inset-x-[-4px] before:bottom-1 before:-z-10 before:h-4 before:bg-accent before:content-['']">
              the game
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-medium leading-relaxed text-muted-foreground">
            Whichever side of the deal you&apos;re on, Podium gets you there faster.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {panels.map(({ role, icon: Icon, tagline, points, cta, href, free, rotate }) => (
            <div
              key={role}
              className="flex flex-col rounded-[10px] border-[1.5px] border-foreground bg-card p-6 shadow-[4px_4px_0_rgba(26,26,26,0.92)] transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-[10px] border-[1.5px] border-foreground bg-accent shadow-[2px_2px_0_rgba(26,26,26,0.92)] ${rotate}`}>
                  <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                </span>
                {free && (
                  <span className="inline-flex items-center gap-1 rounded-md border-[1.5px] border-foreground bg-[#c9f4d8] px-2 py-0.5 text-small font-bold text-[#0f6b38]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0f6b38]" /> Free forever
                  </span>
                )}
              </div>

              <h3 className="mt-5 font-heading text-2xl font-extrabold tracking-tight">{role}</h3>
              <p className="mt-1.5 text-medium font-medium text-muted-foreground">{tagline}</p>

              <ul className="mt-5 space-y-2.5 text-small">
                {points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-foreground bg-accent">
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
