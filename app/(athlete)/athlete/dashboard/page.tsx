import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getMatches } from '@/lib/supabase/messaging'
import StatStrip from '@/components/layout/stat-strip'
import { AccentHeading } from '@/components/ui/accent-heading'
import { SectionDivider } from '@/components/ui/section-divider'
import { buttonVariants } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type MatchRow = Database['public']['Tables']['matches']['Row']

// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Athlete dashboard · Podium',
  description: 'Your sponsorship activity at a glance: connections, conversations and deals.',
  robots: { index: false, follow: false },
}

/**
 * Present a stored display name in title case for the hero (DASH7) without
 * mutating the stored value. Capitalises the first letter after a word boundary
 * (start, whitespace, hyphen or apostrophe) and leaves every other character
 * untouched, so "nick dunn" -> "Nick Dunn" while already-cased names such as
 * "McDonald" or "O'Brien" survive unchanged.
 */
function toTitleCase(name: string): string {
  return name.replace(/(^|[\s'’-])(\p{L})/gu, (_match, boundary: string, letter: string) =>
    boundary + letter.toUpperCase(),
  )
}

/**
 * A profile is "fleshed out" once the discoverability-relevant fields are set.
 * Mirrors the field set behind the settings page's completeness meter so the
 * dashboard's first-run prompt (DASH5) stays honest; kept boolean rather than a
 * percentage so there is no second, drifting number competing with settings.
 * The `as object` casts match the settings form: these JSON columns are typed
 * as `Json` and only their key count matters here.
 */
function needsProfileWork(profile: AthleteRow): boolean {
  const done = [
    Boolean(profile.profile_photo_url),
    Boolean(profile.primary_sport),
    Boolean(profile.level),
    (profile.action_photos?.length ?? 0) > 0,
    (profile.highlight_videos?.length ?? 0) > 0,
    Object.keys((profile.social_accounts as object) ?? {}).length > 0,
    Object.keys((profile.performance_stats as object) ?? {}).length > 0,
    Boolean(profile.notable_achievements),
  ]
  return done.some((field) => !field)
}

export default async function AthleteDashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, matches] = await Promise.all([
    getOwnProfile(supabase, user.id, 'athlete') as Promise<AthleteRow | null>,
    getMatches(supabase, user.id) as Promise<MatchRow[]>,
  ])

  if (!profile) redirect('/athlete/onboarding')
  if (profile.status === 'draft') redirect('/athlete/onboarding/step/1')

  const activeMatches = matches.filter((m) => m.status === 'active')

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div>
        <AccentHeading as="h1" className="text-display">
          Welcome back, {toTitleCase(profile.display_name ?? '')}
        </AccentHeading>
        <p className="mt-3 max-w-[46ch] text-medium leading-relaxed text-muted-foreground">
          {profile.status === 'pending_review'
            ? 'Your profile is under review. We will notify you when it goes live.'
            : 'Your profile is live.'}
        </p>
      </div>

      {needsProfileWork(profile) ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-medium font-medium text-foreground">
              Complete your profile to get discovered
            </p>
            <p className="mt-1 max-w-[52ch] text-small text-muted-foreground">
              Brands search on sport, level and highlights. A fuller profile shows up in more of
              their results.
            </p>
          </div>
          <Link href={ROUTES.athlete.settings} className={buttonVariants()}>
            Finish your profile
          </Link>
        </div>
      ) : null}

      <SectionDivider label="At a glance" />

      <StatStrip
        className="sm:grid-cols-3"
        stats={[
          {
            label: 'Active conversations',
            value: String(activeMatches.length),
            iconKey: 'partners',
          },
          {
            label: 'Sport',
            value: profile.primary_sport ?? 'Not set',
            iconKey: 'trophy',
          },
          {
            label: 'Profile status',
            value: profile.status.replace('_', ' '),
            iconKey: 'verified',
          },
        ]}
      />

      <SectionDivider label="Get going" />

      <div className="flex flex-wrap gap-3">
        <Link href={ROUTES.athlete.discover} className={buttonVariants()}>
          Discover brands
        </Link>
        <Link href={ROUTES.athlete.messages} className={buttonVariants({ variant: 'outline' })}>
          Messages
        </Link>
        <Link href={ROUTES.athlete.requests} className={buttonVariants({ variant: 'outline' })}>
          Requests
        </Link>
      </div>
    </div>
  )
}
