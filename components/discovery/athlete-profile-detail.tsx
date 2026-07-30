import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { isRemoteImageSrc } from '@/components/ui/image-src'
import { AvailabilityBadge, LevelChip, VerifiedBadge } from '@/components/ui/status-badges'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

interface Props {
  athlete: AthleteRow
  /** Where the "Back" affordance returns to (the viewer's discovery surface). */
  backHref: string
  backLabel?: string
  /**
   * Whether this athlete holds an approved verification request
   * (`lib/supabase/verification.ts` is the source of truth). Resolved by the
   * page, since only a server component can query it.
   */
  verified?: boolean
  /** Optional call-to-action rendered beneath the summary (e.g. send a request). */
  action?: React.ReactNode
}

const SEEKING_LABELS: Record<string, string> = {
  product_gifting: 'Product gifting',
  paid_partnership: 'Paid partnership',
  brand_ambassador: 'Brand ambassador',
  social_content: 'Social content',
  event_appearance: 'Event appearance',
  affiliate_code: 'Affiliate / discount code',
  equipment_sponsorship: 'Equipment sponsorship',
  nutrition_supplement: 'Nutrition & supplements',
  apparel_deal: 'Apparel deal',
  university_nil_collective: 'University / NIL collective',
  endorsement: 'Endorsement',
  sponsorship: 'Sponsorship',
  ambassador: 'Brand ambassador',
  media_appearance: 'Media appearance',
  product_deal: 'Product deal',
}

function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function seekingLabel(value: string): string {
  return SEEKING_LABELS[value] ?? humanise(value)
}

/**
 * PR-3 / B-4 — the athlete detail surface other roles land on from discovery.
 *
 * `app/(athlete)/athlete/profile/[userId]` lives behind the athlete-only route
 * group layout, so brands and agents cannot use it. This component renders the
 * same athlete row for those roles, and answers the three questions a sponsor
 * actually has: what are they looking for, when are they available, and are
 * they open to connection requests or only browsing.
 */
export default function AthleteProfileDetail({
  athlete,
  backHref,
  backLabel = 'Back to discover',
  verified = false,
  action,
}: Props) {
  const name = athlete.display_name ?? 'Athlete'
  const sport = athlete.primary_sport
  const level = athlete.level ? humanise(athlete.level) : null
  const location = [athlete.home_city, athlete.home_country].filter(Boolean).join(', ')
  const seeking = athlete.seeking ?? []
  const photoSrc = athlete.profile_photo_url ?? '/placeholder-athlete.svg'

  // "Open to requests" is the athlete's own availability signal: anything other
  // than not_available means a sponsor can reasonably reach out today.
  const openToRequests =
    athlete.availability_status === 'available_now' ||
    athlete.availability_status === 'available_from'

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <Link href={backHref} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* A-2: explicit 112×112 intrinsic size; above the fold, so no lazy. */}
        <Image
          src={photoSrc}
          alt={`${name} profile photo`}
          width={112}
          height={112}
          priority
          unoptimized={isRemoteImageSrc(photoSrc)}
          className="size-28 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0 space-y-3">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            {name}
          </h1>
          <p className="text-medium text-muted-foreground">
            {[sport, level, location].filter(Boolean).join(' · ') || 'Athlete on Podium'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {/* QA-3.1: this used to read `status === 'active'`, i.e. every
                published profile was shown a "Verified" trust badge nobody had
                earned, while an actual admin approval changed nothing. The badge
                now reflects an approved verification request and nothing else. */}
            {verified ? <VerifiedBadge verified /> : null}
            {athlete.level ? <LevelChip level={humanise(athlete.level)} /> : null}
            {athlete.availability_status ? (
              <AvailabilityBadge
                status={athlete.availability_status}
                {...(athlete.available_from_date ? { date: athlete.available_from_date } : {})}
              />
            ) : null}
          </div>
        </div>
      </header>

      {/* PR-3: open to requests, or just browsing? */}
      <section aria-labelledby="openness-heading" className="space-y-3">
        <h2 id="openness-heading" className="font-heading text-large font-semibold text-foreground">
          Open to connection requests?
        </h2>
        <p
          data-testid="openness"
          className={cn(
            'rounded-2xl border p-6 text-medium',
            openToRequests
              ? 'border-success/40 bg-success/10 text-foreground'
              : 'border-border bg-muted text-muted-foreground',
          )}
        >
          {openToRequests
            ? `${name} is open to connection requests${
                athlete.availability_status === 'available_from' && athlete.available_from_date
                  ? ` from ${new Date(athlete.available_from_date).toLocaleDateString()}`
                  : ''
              }.`
            : `${name} is browsing only right now and is not taking connection requests.`}
        </p>
      </section>

      <section aria-labelledby="seeking-heading" className="space-y-3">
        <h2 id="seeking-heading" className="font-heading text-large font-semibold text-foreground">
          What they&apos;re looking for
        </h2>
        {seeking.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {seeking.map((s) => (
              <li
                key={s}
                className="rounded-full border border-border bg-card px-3 py-1 text-small text-foreground"
              >
                {seekingLabel(s)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-medium text-muted-foreground">
            {name} has not listed the kinds of deals they are looking for yet.
          </p>
        )}
      </section>

      <section aria-labelledby="availability-heading" className="space-y-3">
        <h2 id="availability-heading" className="font-heading text-large font-semibold text-foreground">
          Availability
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-small text-muted-foreground">Status</dt>
            <dd className="text-medium text-foreground">
              {athlete.availability_status ? humanise(athlete.availability_status) : 'Not stated'}
            </dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Available from</dt>
            <dd className="text-medium text-foreground">
              {athlete.available_from_date
                ? new Date(athlete.available_from_date).toLocaleDateString()
                : 'Not stated'}
            </dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Travel radius</dt>
            <dd className="text-medium text-foreground">
              {athlete.travel_radius_km ? `${athlete.travel_radius_km} km` : 'Not stated'}
            </dd>
          </div>
        </dl>
      </section>

      {athlete.notable_achievements ? (
        <section aria-labelledby="achievements-heading" className="space-y-3">
          <h2
            id="achievements-heading"
            className="font-heading text-large font-semibold text-foreground"
          >
            Notable achievements
          </h2>
          <p className="whitespace-pre-line text-medium leading-relaxed text-muted-foreground">
            {athlete.notable_achievements}
          </p>
        </section>
      ) : null}

      {action ? <div>{action}</div> : null}
    </div>
  )
}
