import Link from 'next/link'
import SignUpForm from '@/components/auth/sign-up-form'
import { parseRole } from '@/components/auth/intended-role'
import { ROUTES } from '@/lib/routes'

const ROLE_HEADLINE: Record<string, { title: string; blurb: string }> = {
  athlete: {
    title: 'Create your athlete profile',
    blurb: 'Free forever. Get discovered by the brands that want to back you.',
  },
  team: {
    title: 'List your team',
    blurb: 'Free forever. Turn your fanbase into your next sponsor.',
  },
  brand: {
    title: 'Start finding talent',
    blurb: 'Search verified athletes and teams, and reach out direct.',
  },
  agent: {
    title: 'Manage your roster',
    blurb: 'Free forever. Represent athletes and teams from one dashboard.',
  },
}

/**
 * M-3/PR-10: the two landing CTAs diverge into `?role=brand` and
 * `?role=athlete`. The role is echoed in the page copy and carried through to
 * the role step so signup does not start from a blank slate.
 */
// M-1: per-route metadata. This page is public and indexable — see app/sitemap.ts.
export const metadata = {
  title: 'Create your account · Podium',
  description:
    'Join Podium free as an athlete, team or agent, or sign up as a brand to find the talent to back.',
  openGraph: {
    type: 'website',
    title: 'Create your Podium account',
    description: 'Free forever for athletes, teams and agents. Get discovered by brands.',
  },
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>
}) {
  const { role: roleParam } = await searchParams
  const role = parseRole(roleParam)
  const headline = role
    ? ROLE_HEADLINE[role]
    : {
        title: 'Create your account',
        blurb: 'Join Podium, free for athletes, teams & agents',
      }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            {headline?.title}
          </h1>
          <p className="mt-3 text-medium text-muted-foreground">{headline?.blurb}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <SignUpForm {...(role ? { role } : {})} />
        </div>
        <p className="mt-6 text-center text-medium text-muted-foreground">
          Already have an account?{' '}
          <Link href={ROUTES.auth.signIn} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
