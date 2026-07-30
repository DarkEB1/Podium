import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { buttonVariants } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Your team profile · Podium',
  description: 'Review and edit the profile sponsors see.',
  robots: { index: false },
}


type TeamRow = Database['public']['Tables']['team_profiles']['Row']

function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * B-4 — the team nav's "Profile" item pointed at `/team/profile`, which did not
 * exist (the team dashboard and the discovery empty state both linked here
 * too). This renders the team profile as sponsors see it; editing stays in
 * Settings, which already hosts the form.
 */
export default async function TeamProfilePage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  // getOwnProfile returns the role union; role 'team' narrows it to TeamRow.
  const profile = (await getOwnProfile(supabase, user.id, 'team')) as TeamRow | null
  if (!profile) redirect(ROUTES.team.onboarding)

  const name = profile.team_name ?? profile.nickname ?? 'Your team'
  const location = [profile.home_city, profile.home_country].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 space-y-3">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            {name}
          </h1>
          <p className="text-medium text-muted-foreground">
            {[
              profile.sports.join(', ') || null,
              profile.competition_level ? humanise(profile.competition_level) : null,
              location,
            ]
              .filter(Boolean)
              .join(' · ') || 'Your team profile on Podium'}
          </p>
          <p className="text-small text-muted-foreground">
            Profile status: {humanise(profile.status)}
          </p>
        </div>
        <Link href={ROUTES.team.settings} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Edit profile
        </Link>
      </header>

      {profile.bio ? (
        <section aria-labelledby="about-heading" className="space-y-3">
          <h2 id="about-heading" className="font-heading text-large font-semibold text-foreground">
            About
          </h2>
          <p className="whitespace-pre-line text-medium leading-relaxed text-muted-foreground">
            {profile.bio}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="seeking-heading" className="space-y-3">
        <h2 id="seeking-heading" className="font-heading text-large font-semibold text-foreground">
          Sponsorship you&apos;re seeking
        </h2>
        {profile.seeking_sponsorship_types.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {profile.seeking_sponsorship_types.map((item) => (
              <li
                key={item}
                className="rounded-full border border-border bg-card px-3 py-1 text-small text-foreground"
              >
                {humanise(item)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-medium text-muted-foreground">
            You have not listed the sponsorship types you are seeking yet. Add them in Settings so
            sponsors know what to offer.
          </p>
        )}
      </section>

      <section aria-labelledby="reach-heading" className="space-y-3">
        <h2 id="reach-heading" className="font-heading text-large font-semibold text-foreground">
          Reach
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-small text-muted-foreground">Social following</dt>
            <dd className="text-medium text-foreground">
              {profile.total_social_following.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Match-day attendance</dt>
            <dd className="text-medium text-foreground">
              {profile.match_day_attendance?.toLocaleString() ?? 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Home venue</dt>
            <dd className="text-medium text-foreground">{profile.home_venue ?? 'Not set'}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
