'use client'

import { useSearchParams } from 'next/navigation'
import SignUpForm from '@/components/auth/sign-up-form'
import { parseRole } from '@/components/auth/intended-role'

/**
 * PERF — the role-dependent half of /auth/signup, read on the client.
 *
 * The page used to `await searchParams` to pick the headline and pre-fill the
 * role. In the App Router that forces DYNAMIC rendering, so the single most
 * visited top-of-funnel page was a server function invocation on every view
 * with no CDN cache, while every other public page (/pricing, /terms,
 * /contact) prerendered as static. Reading `?role=` here instead lets the
 * whole page be prerendered and served from the edge.
 *
 * `useSearchParams` opts its subtree into client-side reading of the query, so
 * the caller MUST wrap this in <Suspense> or the build fails.
 */

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

const DEFAULT_HEADLINE = {
  title: 'Create your account',
  blurb: 'Join Podium, free for athletes, teams & agents',
}

export default function SignUpPanel() {
  const role = parseRole(useSearchParams().get('role'))
  const headline = (role && ROLE_HEADLINE[role]) || DEFAULT_HEADLINE

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
          {headline.title}
        </h1>
        <p className="mt-3 text-medium text-muted-foreground">{headline.blurb}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
        <SignUpForm {...(role ? { role } : {})} />
      </div>
    </>
  )
}

/**
 * The Suspense fallback. Same shape and spacing as the real panel so the page
 * does not jump when the query is read.
 */
export function SignUpPanelFallback() {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
          {DEFAULT_HEADLINE.title}
        </h1>
        <p className="mt-3 text-medium text-muted-foreground">{DEFAULT_HEADLINE.blurb}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
        <SignUpForm />
      </div>
    </>
  )
}
