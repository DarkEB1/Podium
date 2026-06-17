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
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type MatchRow = Database['public']['Tables']['matches']['Row']

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
          Welcome back, {profile.display_name}
        </AccentHeading>
        <p className="mt-3 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
          {profile.status === 'pending_review'
            ? 'Your profile is under review. We will notify you when it goes live.'
            : 'Your profile is live.'}
        </p>
      </div>

      <SectionDivider label="Your numbers" />

      <StatStrip
        className="sm:grid-cols-3"
        stats={[
          { label: 'Active conversations', value: String(activeMatches.length), iconKey: 'partners' },
          { label: 'Sport', value: profile.primary_sport ?? '—', iconKey: 'trophy' },
          { label: 'Profile status', value: profile.status.replace('_', ' '), iconKey: 'verified' },
        ]}
      />

      <SectionDivider label="Get going" />

      <div className="flex flex-wrap gap-3">
        <Link href="/athlete/discover" className={buttonVariants()}>Browse brands</Link>
        <Link href="/athlete/messages" className={buttonVariants({ variant: 'outline' })}>Messages ({activeMatches.length})</Link>
        <Link href="/athlete/requests" className={buttonVariants({ variant: 'outline' })}>Connection requests</Link>
      </div>
    </div>
  )
}
