import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { isRemoteImageSrc } from '@/components/ui/image-src'
import { LevelChip, VerifiedBadge } from '@/components/ui/status-badges'
import type { Database } from '@/types/database'

type TeamRow = Database['public']['Tables']['team_profiles']['Row']

interface Props {
  team: TeamRow
  backHref: string
  backLabel?: string
  /** Optional call-to-action rendered beneath the summary. */
  action?: React.ReactNode
}

const SPONSORSHIP_LABELS: Record<string, string> = {
  shirt_sponsorship: 'Shirt sponsorship',
  kit_sponsorship: 'Kit sponsorship',
  stadium_naming: 'Stadium naming',
  matchday_activation: 'Matchday activation',
  digital_content: 'Digital content',
  community_programme: 'Community programme',
  product_supply: 'Product supply',
  hospitality: 'Hospitality',
  event_sponsorship: 'Event sponsorship',
  brand_ambassador: 'Brand ambassador',
}

function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function sponsorshipLabel(value: string): string {
  return SPONSORSHIP_LABELS[value] ?? humanise(value)
}

/**
 * 2.2 — the team detail surface a brand lands on from team discovery. Read-only
 * and public-safe: it answers what a sponsor wants to know (who they are, their
 * reach, and what sponsorship they are seeking) without exposing the team's
 * private commercial-contact details.
 */
export default function TeamProfileDetail({ team, backHref, backLabel = 'Back to teams', action }: Props) {
  const name = team.team_name ?? 'Team'
  const sport = team.sports?.[0]
  const level = team.competition_level ? humanise(team.competition_level) : null
  const location = [team.home_city, team.home_country].filter(Boolean).join(', ')
  const seeking = team.seeking_sponsorship_types ?? []
  const logoSrc = team.logo_url ?? team.cover_photo_url ?? '/placeholder-cover.svg'
  const following = team.total_social_following ?? 0

  function stat(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return 'Not stated'
    return String(value)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <Link href={backHref} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Image
          src={logoSrc}
          alt={`${name} logo`}
          width={112}
          height={112}
          priority
          unoptimized={isRemoteImageSrc(logoSrc)}
          className="size-28 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0 space-y-3">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            {name}
          </h1>
          <p className="text-medium text-muted-foreground">
            {[sport, level, location].filter(Boolean).join(' · ') || 'Team on Podium'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {team.status === 'active' ? <VerifiedBadge verified /> : null}
            {team.competition_level ? <LevelChip level={humanise(team.competition_level)} /> : null}
          </div>
        </div>
      </header>

      <section aria-labelledby="seeking-heading" className="space-y-3">
        <h2 id="seeking-heading" className="font-heading text-large font-semibold text-foreground">
          Sponsorship they&apos;re seeking
        </h2>
        {seeking.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {seeking.map((s) => (
              <li
                key={s}
                className="rounded-full border border-border bg-card px-3 py-1 text-small text-foreground"
              >
                {sponsorshipLabel(s)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-medium text-muted-foreground">
            {name} has not listed the sponsorship types they are seeking yet.
          </p>
        )}
      </section>

      <section aria-labelledby="reach-heading" className="space-y-3">
        <h2 id="reach-heading" className="font-heading text-large font-semibold text-foreground">
          Reach
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-small text-muted-foreground">Fan reach</dt>
            <dd className="text-medium text-foreground">
              {team.fan_reach ? humanise(team.fan_reach) : 'Not stated'}
            </dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Social following</dt>
            <dd className="text-medium text-foreground">
              {following > 0 ? following.toLocaleString() : 'Not stated'}
            </dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Matchday attendance</dt>
            <dd className="text-medium text-foreground">{stat(team.match_day_attendance)}</dd>
          </div>
        </dl>
      </section>

      {team.bio ? (
        <section aria-labelledby="about-heading" className="space-y-3">
          <h2 id="about-heading" className="font-heading text-large font-semibold text-foreground">
            About
          </h2>
          <p className="whitespace-pre-line text-medium leading-relaxed text-muted-foreground">
            {team.bio}
          </p>
        </section>
      ) : null}

      {action ? <div>{action}</div> : null}
    </div>
  )
}
