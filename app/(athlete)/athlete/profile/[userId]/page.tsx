import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getPublicProfile } from '@/lib/supabase/profiles'
import { isVerified } from '@/lib/supabase/verification'
import { athleteLevelLabel } from '@/lib/levels'
import { COUNTRIES } from '@/lib/data/countries'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BreadcrumbLabel } from '@/components/layout/breadcrumb-label'
import ProfileHero from '@/components/athlete/profile-hero'
import ProfileStatStrip from '@/components/athlete/profile-stat-strip'
import ProfileGallery from '@/components/athlete/profile-gallery'
import ProfileSocialStrip, {
  type SocialAccounts,
} from '@/components/athlete/profile-social-strip'
import ProfileSeeking from '@/components/athlete/profile-seeking'
import ConnectRequestButton from '@/components/discovery/connect-request-button'

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

/**
 * The verification request flow lives on the cross-role security settings page
 * (`app/settings/security/page.tsx` renders `VerificationSection`, which POSTs
 * to `/api/account/verification`). Not represented in `lib/routes.ts`, so the
 * path is referenced here directly.
 */
const VERIFICATION_HREF = '/settings/security'

/** ISO alpha-2 code -> English country name ("GB" -> "United Kingdom"). */
const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.name]),
)

/** Full country name for a stored code, or the code itself if it is unknown. */
function countryName(code: string | null): string | null {
  if (!code) return null
  return COUNTRY_NAMES[code.toUpperCase()] ?? code
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

/** Whether any of the four handle slots carries a non-empty value. */
function hasAnySocialHandle(social: SocialAccounts): boolean {
  for (const key of ['instagram', 'tiktok', 'youtube', 'twitter'] as const) {
    const v = social[key]
    if (typeof v === 'string' && v.trim().length > 0) return true
  }
  return false
}

export default async function AthletePublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ preview?: string }>
}) {
  const { userId } = await params
  const { preview } = await searchParams
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
  // PROF5: show the full country name ("United Kingdom") rather than the raw
  // stored ISO code ("GB"); the city is kept when present.
  const location =
    [profile.home_city, countryName(profile.home_country)].filter(Boolean).join(', ') ||
    undefined

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

  // PROF8: the owner can view their own profile exactly as a brand sees it via
  // `?preview=brand`. While previewing, owner-only prompts are suppressed and
  // the brand-facing CTA is shown (as a non-functional preview).
  const previewingAsBrand = isOwner && preview === 'brand'
  const viewAsOwner = isOwner && !previewingAsBrand

  // The settings page hosts the profile form (photos, socials) in its
  // `#profile` section — see components/athlete/settings-form.tsx.
  const settingsHref = `${ROUTES.athlete.settings}#profile`
  const ownProfileHref = ROUTES.athlete.profileFor(userId)

  // Followers: canonical source is the numeric self-reported counts stored in
  // social_accounts; performance_stats.followers survives as a legacy
  // fallback because no current UI writes it.
  const followerCount = maxSelfReportedFollowers(profile.social_accounts)
  const followers =
    followerCount > 0
      ? formatCount(followerCount)
      : readStat(profile.performance_stats, 'followers')
  const engagement = readStat(profile.performance_stats, 'engagement')

  const hasSocials = hasAnySocialHandle(social)
  const hasPhotos = profile.action_photos.length > 0
  const about = profile.notable_achievements?.trim() || null

  // PROF6: for the non-owner (brand-preview) view, sparse sections are hidden
  // so an empty page does not read as "nothing here". The owner still sees
  // every section, each carrying its own fix-it prompt.
  const showAbout = Boolean(about) || viewAsOwner
  const showGallery = hasPhotos || viewAsOwner
  const showSocial = hasSocials || viewAsOwner

  // PROF7: a persistent primary CTA in the hero for the non-owner view, using
  // the existing connect-request affordance. NOTE: the `(athlete)` route group
  // redirects non-athletes to /403, so a real non-owner here is another
  // athlete — a brand reaches an athlete through /brand/discover/[userId]
  // (components/discovery/athlete-profile-detail.tsx), which already renders
  // this same ConnectRequestButton.
  const openToRequests =
    availabilityStatus === 'available_now' || availabilityStatus === 'available_from'
  let heroAction: React.ReactNode = null
  if (!viewAsOwner) {
    heroAction = previewingAsBrand ? (
      // Preview only: shows the owner what a brand sees without letting them
      // send a request to themselves (the API rejects SELF_CONNECT anyway).
      <Button disabled>Send connection request</Button>
    ) : (
      <ConnectRequestButton
        recipientUserId={profile.user_id}
        recipientName={name}
        recipientRole="athlete"
        surface="athlete_public_profile"
        {...(openToRequests
          ? {}
          : {
              unavailableReason: `${name} is browsing only right now and is not taking connection requests.`,
            })}
      />
    )
  }

  // PROF6: an owner-only profile-completeness signal so the owner can see, at a
  // glance, how much of what a brand needs is present.
  const completenessChecks = [
    Boolean(profile.profile_photo_url),
    Boolean(about),
    hasSocials,
    profile.seeking.length > 0,
    hasPhotos,
    Boolean(availabilityStatus),
  ]
  const completeCount = completenessChecks.filter(Boolean).length
  const completePct = Math.round((completeCount / completenessChecks.length) * 100)

  return (
    <div className="pb-16">
      {/* Names the trail's last crumb; the path segment is a raw UUID. */}
      <BreadcrumbLabel label={name} />

      <ProfileHero
        avatar={profile.profile_photo_url}
        name={name}
        tagline={tagline}
        {...(location ? { location } : {})}
        verified={verified}
        {...(availability ? { availability } : {})}
        {...(heroAction ? { action: heroAction } : {})}
      />

      <div className="mx-auto mt-12 max-w-5xl space-y-16 px-6 md:px-16">
        {/* PROF8: banner while the owner previews as a brand. */}
        {previewingAsBrand ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4"
          >
            <p className="text-medium text-foreground">
              You&apos;re previewing your profile as a brand sees it. Owner-only
              prompts are hidden.
            </p>
            <Link
              href={ownProfileHref}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Exit preview
            </Link>
          </div>
        ) : null}

        {/* PROF6/PROF8/PROF4: owner tools — completeness, preview, verification. */}
        {viewAsOwner ? (
          <section
            aria-labelledby="owner-tools-heading"
            className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="owner-tools-heading"
                className="font-heading text-large font-semibold text-foreground"
              >
                Your profile
              </h2>
              <span className="text-small text-muted-foreground">
                {completePct}% complete
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={completePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completeness"
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${completePct}%` }}
              />
            </div>
            <p className="text-small text-muted-foreground">
              Everything below opens your{' '}
              <Link
                href={settingsHref}
                className="text-primary underline-offset-2 hover:underline"
              >
                settings
              </Link>
              , where you edit what brands see.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`${ownProfileHref}?preview=brand`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Preview as brand
              </Link>
              {!verified ? (
                <Link
                  href={VERIFICATION_HREF}
                  title="Verification adds a trust badge to your profile once our team confirms your identity."
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Get verified
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* PROF1: headline + About near the top so a brand can understand the
            athlete. notable_achievements is the only free-text "story" field the
            schema carries today; a dedicated bio/headline column is flagged. */}
        {showAbout ? (
          <section aria-labelledby="about-heading" className="space-y-4">
            <h2
              id="about-heading"
              className="font-heading text-large font-semibold text-foreground"
            >
              About {name}
            </h2>
            {about ? (
              <p className="max-w-prose whitespace-pre-line text-medium leading-relaxed text-muted-foreground">
                {about}
              </p>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6">
                <p className="text-medium text-foreground">Tell brands your story</p>
                <p className="mt-1 max-w-prose text-small text-muted-foreground">
                  Add a short bio and your notable achievements in Settings so
                  brands understand who you are and why to work with you.
                </p>
                <Link
                  href={settingsHref}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}
                >
                  Add your story
                </Link>
              </div>
            )}
          </section>
        ) : null}

        {/* PROF9: the stats region is labelled (was previously unlabelled). */}
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Audience and profile stats
          </h2>
          <ProfileStatStrip
            followers={followers}
            engagement={engagement}
            sport={sport}
            level={level}
            isOwner={viewAsOwner}
            settingsHref={settingsHref}
          />
        </section>

        <section aria-labelledby="seeking-heading" className="space-y-4">
          <h2 id="seeking-heading" className="font-heading text-large font-semibold text-foreground">
            Seeking
          </h2>
          <ProfileSeeking
            seeking={profile.seeking}
            isSeeking={profile.is_seeking ?? true}
            isOwner={viewAsOwner}
            name={name}
          />
        </section>

        {showGallery ? (
          <section aria-labelledby="gallery-heading" className="space-y-4">
            <h2 id="gallery-heading" className="font-heading text-large font-semibold text-foreground">
              Gallery
            </h2>
            <ProfileGallery
              name={name}
              photos={profile.action_photos}
              isOwner={viewAsOwner}
              manageHref={settingsHref}
            />
          </section>
        ) : null}

        {showSocial ? (
          <section aria-labelledby="social-heading" className="space-y-4">
            <h2 id="social-heading" className="font-heading text-large font-semibold text-foreground">
              Social
            </h2>
            <ProfileSocialStrip
              accounts={social}
              isOwner={viewAsOwner}
              connectHref={settingsHref}
            />
          </section>
        ) : null}
      </div>
    </div>
  )
}
