import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const panels = [
  {
    role: 'Athletes',
    tagline: 'Get discovered. Close deals.',
    points: ['Free forever — no subscription', 'Create a rich profile with stats and media', 'Browse brand campaigns and connect directly', 'E-sign contracts and receive payments'],
    cta: 'Create Athlete Profile',
    href: '/auth/signup',
  },
  {
    role: 'Teams',
    tagline: 'Find your next sponsor.',
    points: ['Free forever — no subscription', 'Showcase your fanbase and reach', 'Browse sponsor campaigns that fit your club', 'Negotiate and sign sponsorship deals'],
    cta: 'List Your Team',
    href: '/auth/signup',
  },
  {
    role: 'Brands & Sponsors',
    tagline: 'Access elite talent at scale.',
    points: ['Powerful search and filter tools', 'Connect with verified athletes and teams', 'Manage campaigns, proposals, and contracts', 'Subscription from Tier 1 (7-day free trial)'],
    cta: 'Start Finding Talent',
    href: '/auth/signup',
  },
]

export default function RolePanels() {
  return (
    <section id="who" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-12 text-center text-3xl font-bold">Built for Everyone in Sport</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {panels.map((p) => (
            <div key={p.role} className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="text-xl font-bold">{p.role}</h3>
              <p className="text-muted-foreground">{p.tagline}</p>
              <ul className="space-y-2 text-sm">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-500">✓</span>
                    {pt}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={cn(buttonVariants(), 'mt-auto')}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
