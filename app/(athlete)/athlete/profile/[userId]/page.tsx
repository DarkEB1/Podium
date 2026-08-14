import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getPublicProfile } from '@/lib/supabase/profiles'
import { isVerified } from '@/lib/supabase/verification'
import type { Database } from '@/types/database'

import ProfileHero from '@/components/athlete/profile-hero'
import ProfileStatStrip from '@/components/athlete/profile-stat-strip'
import ProfileGallery from '@/components/athlete/profile-gallery'
import ProfileSocialStrip, {
  type SocialAccounts,
} from '@/components/athlete/profile-social-strip'
import ProfileSeeking from '@/components/athlete/profile-seeking'

/**
 * M-1 — deliberately GENERIC and identical for every record.
 *
 * A page title is written to browser history, sent in the document title to
 * analytics, and is visible on a shared screen or a screencast. Interpolating
 * the subject's name here ("Sarah Okoro — Athlete") would leak a real person's
 * identity into all three, so the title says only what kind of page this is.
 * `robots: { index: false }` keeps it out of search results as well.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Athlete profile · Podium',
    description: 'An athlete profile on Podium.',
    robots: { index: false },
  }
}


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

  // QA-3.1: verification is an approved verification_requests row, not a
  // published profile. Reading status here meant every athlete wore a trust
  // badge they had not been granted, and an admin approving a real request
  // changed nothing anywhere in the UI.
  const verified = await isVerified(supabase, userId)

  return (
    <div className="pb-16">
      <ProfileHero
        coverImage={profile.profile_photo_url}
        name={name}
        tagline={tagline}
        location={location}
        verified={verified}
        availability={availability}
      />

      <div className="mx-auto mt-12 max-w-5xl space-y-16 px-6 md:px-16">
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
