import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getPublicProfile } from '@/lib/supabase/profiles'
import { isVerified } from '@/lib/supabase/verification'
import { athleteLevelLabel } from '@/lib/levels'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

import { BreadcrumbLabel } from '@/components/layout/breadcrumb-label'
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

/** performance_stats is free-form JSON; read a stat as a display string if present. */
function readStat(stats: AthleteRow['performance_stats'], key: string): string | null {
  if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
    const v = (stats as Record<string, unknown>)[key]
    if (typeof v === 'string' && v.length > 0) return v
    if (typeof v === 'number') return String(v)
  }
  return null
}

/**
 * Largest self-reported follower count across the numeric social_accounts
 * keys — the app's canonical audience source (mirrors `maxFollowers` in
 * lib/matching/score.ts and the headline stat in
 * components/brand/athlete-card.tsx).
 */
function maxSelfReportedFollowers(social: unknown): number {
  if (!social || typeof social !== 'object') return 0
  const rec = social as Record<string, unknown>
  let max = 0
  for (const key of [
    'instagram_followers',
    'tiktok_followers',
    'youtube_subscribers',
    'twitter_followers',
  ]) {
    const raw = rec[key]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return max
}

/** 12400 -> "12.4K", 1000000 -> "1M". */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
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
  // Shared canonical level labels (lib/levels.ts) so this page renders
  // "Semi-Professional" exactly as settings does, hyphen included.
  const level = athleteLevelLabel(profile.level)
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

  // Owner view: empty tiles/sections become actionable links into settings.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isOwner = user?.id === userId
  // The settings page hosts the profile form (photos, socials) in its
  // `#profile` section — see components/athlete/settings-form.tsx.
  const settingsHref = `${ROUTES.athlete.settings}#profile`

  // Followers: canonical source is the numeric self-reported counts stored in
  // social_accounts; performance_stats.followers survives as a legacy
  // fallback because no current UI writes it.
  const followerCount = maxSelfReportedFollowers(profile.social_accounts)
  const followers =
    followerCount > 0
      ? formatCount(followerCount)
      : readStat(profile.performance_stats, 'followers')

  return (
    <div className="pb-16">
      {/* Names the trail's last crumb; the path segment is a raw UUID. */}
      <BreadcrumbLabel label={name} />
      <ProfileHero
        avatar={profile.profile_photo_url}
        name={name}
        tagline={tagline}
        location={location}
        verified={verified}
        availability={availability}
      />

      <div className="mx-auto mt-12 max-w-5xl space-y-16 px-6 md:px-16">
        <ProfileStatStrip
          followers={followers}
          engagement={readStat(profile.performance_stats, 'engagement')}
          sport={sport}
          level={level}
          isOwner={isOwner}
          settingsHref={settingsHref}
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
          <ProfileGallery
            name={name}
            photos={profile.action_photos}
            isOwner={isOwner}
            manageHref={settingsHref}
          />
        </section>

        <section aria-labelledby="social-heading" className="space-y-4">
          <h2 id="social-heading" className="font-heading text-large font-semibold text-foreground">
            Social
          </h2>
          <ProfileSocialStrip
            accounts={social}
            isOwner={isOwner}
            connectHref={settingsHref}
          />
        </section>
      </div>
    </div>
  )
}
