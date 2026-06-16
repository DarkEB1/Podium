import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getPublicProfile } from '@/lib/supabase/profiles'
import type { Database } from '@/types/database'

import ProfileHero from '@/components/athlete/profile-hero'
import ProfileStatStrip from '@/components/athlete/profile-stat-strip'
import ProfileGallery from '@/components/athlete/profile-gallery'
import ProfileSocialStrip, {
  type SocialAccounts,
} from '@/components/athlete/profile-social-strip'
import ProfileSeeking from '@/components/athlete/profile-seeking'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

const AVAILABILITY = new Set(['available_now', 'available_from', 'not_available'])

/** "national_academy" -> "National academy" */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** performance_stats is free-form JSON; read a stat as a display string if present. */
function readStat(stats: AthleteRow['performance_stats'], key: string): string | null {
  if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
    const v = (stats as Record<string, unknown>)[key]
    if (typeof v === 'string' && v.length > 0) return v
    if (typeof v === 'number') return String(v)
  }
  return null
}

export default async function AthletePublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = await createClient()
  // getPublicProfile returns the role union ProfileRow; we pass role 'athlete'
  // so the row is an AthleteRow. Narrow via unknown to access athlete-only cols.
  const profile = (await getPublicProfile(supabase, userId, 'athlete')) as
    | AthleteRow
    | null

  if (!profile) notFound()

  const name = profile.display_name ?? 'Athlete'
  const sport = profile.primary_sport ?? null
  const level = profile.level ? humanise(profile.level) : null
  const tagline = [sport, level].filter(Boolean).join(' · ') || undefined
  const location =
    [profile.home_city, profile.home_country].filter(Boolean).join(', ') || undefined

  const availabilityStatus = profile.availability_status
  const availability =
    availabilityStatus && AVAILABILITY.has(availabilityStatus)
      ? {
          status: availabilityStatus as
            | 'available_now'
            | 'available_from'
            | 'not_available',
          ...(profile.available_from_date
            ? { date: profile.available_from_date }
            : {}),
        }
      : undefined

  const social = (profile.social_accounts ?? {}) as SocialAccounts

  return (
    <div className="pb-16">
      <ProfileHero
        coverImage={profile.profile_photo_url}
        name={name}
        tagline={tagline}
        location={location}
        verified={profile.status === 'active'}
        availability={availability}
      />

      <div className="mx-auto mt-8 max-w-7xl space-y-12 px-4">
        <ProfileStatStrip
          followers={readStat(profile.performance_stats, 'followers')}
          engagement={readStat(profile.performance_stats, 'engagement')}
          sport={sport}
          level={level}
        />

        <section aria-labelledby="seeking-heading" className="space-y-4">
          <h2 id="seeking-heading" className="font-heading text-large font-semibold text-foreground">
            Seeking
          </h2>
          <ProfileSeeking seeking={profile.seeking} />
        </section>

        <section aria-labelledby="gallery-heading" className="space-y-4">
          <h2 id="gallery-heading" className="font-heading text-large font-semibold text-foreground">
            Gallery
          </h2>
          <ProfileGallery name={name} photos={profile.action_photos} />
        </section>

        <section aria-labelledby="social-heading" className="space-y-4">
          <h2 id="social-heading" className="font-heading text-large font-semibold text-foreground">
            Social
          </h2>
          <ProfileSocialStrip accounts={social} />
        </section>
      </div>
    </div>
  )
}
