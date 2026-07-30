'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AtSign, Camera, MapPin, Music2, Navigation, Pencil, Video } from 'lucide-react'

import { isRemoteImageSrc } from '@/components/ui/image-src'

import { buttonVariants } from '@/components/ui/button'
import {
  AvailabilityBadge,
  LevelChip,
  SeekingTag,
} from '@/components/ui/status-badges'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type AvailabilityStatus = Database['public']['Enums']['availability_status']

// social_accounts is stored as free-form JSON. It may hold either a bare URL
// string (legacy onboarding writes) or an object carrying the URL plus an
// optional follower count. Both shapes are handled when rendering (§3B.1).
type SocialEntry = string | { url?: string; followers?: number } | null | undefined
type SocialAccounts = Partial<Record<'instagram' | 'tiktok' | 'youtube' | 'twitter', SocialEntry>>

interface Props {
  profile: AthleteRow
  /**
   * Jump back to a specific onboarding step. Defaults to router navigation to
   * `/athlete/onboarding/step/<n>`; injected in tests for assertion.
   */
  onEditStep?: (step: number) => void
}

// ─── Display helpers ───────────────────────────────────────────────────────────

// Humanise an enum-ish value: "paid_partnership" -> "Paid partnership".
function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// Compact follower count: 12400 -> "12.4K", 3_200_000 -> "3.2M".
function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function readSocial(entry: SocialEntry): { url: string; followers: number | null } | null {
  if (!entry) return null
  if (typeof entry === 'string') return entry ? { url: entry, followers: null } : null
  if (entry.url) return { url: entry.url, followers: typeof entry.followers === 'number' ? entry.followers : null }
  return null
}

const SOCIAL_PLATFORMS: { key: keyof SocialAccounts; label: string; Icon: typeof Camera }[] = [
  { key: 'instagram', label: 'Instagram', Icon: Camera },
  { key: 'tiktok', label: 'TikTok', Icon: Music2 },
  { key: 'youtube', label: 'YouTube', Icon: Video },
  { key: 'twitter', label: 'X / Twitter', Icon: AtSign },
]

// ─── Section frame ───────────────────────────────────────────────────────────

function SectionEdit({
  label,
  step,
  onEditStep,
}: {
  label: string
  step: number
  onEditStep: (step: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onEditStep(step)}
      aria-label={`Edit ${label}`}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        'h-auto gap-1 px-2 py-1 text-small text-muted-foreground',
      )}
    >
      <Pencil aria-hidden="true" className="size-3.5" />
      <span>Edit</span>
    </button>
  )
}

function SectionHeader({
  title,
  label,
  step,
  onEditStep,
}: {
  title: string
  label: string
  step: number
  onEditStep: (step: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-medium font-medium text-foreground">{title}</h3>
      <SectionEdit label={label} step={step} onEditStep={onEditStep} />
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * ProfilePreview — the onboarding "review & confirm" summary card (spec §3B.1).
 * Renders, in order: large circular photo, name, sport + position, LevelChip,
 * city-only location with a pin, travel radius, SeekingTag chips, connected
 * socials with follower counts, a colour-coded AvailabilityBadge, and an
 * action-photo thumbnail strip. Every section carries an "Edit" button that
 * jumps back to the relevant onboarding step.
 */
export default function ProfilePreview({ profile, onEditStep }: Props) {
  const router = useRouter()
  const editStep =
    onEditStep ?? ((step: number) => router.push(`/athlete/onboarding/step/${step}`))

  const name = profile.display_name ?? 'Athlete'
  const initial = (profile.display_name ?? '?')[0]?.toUpperCase() ?? '?'

  const sportLine = [profile.primary_sport, profile.position]
    .filter((v): v is string => Boolean(v))
    .join(' · ')

  const social = (profile.social_accounts ?? {}) as SocialAccounts
  const connectedSocials = SOCIAL_PLATFORMS.map((p) => ({
    ...p,
    data: readSocial(social[p.key]),
  })).filter((p) => p.data !== null)

  const availabilityStatus = (profile.availability_status ?? 'not_available') as AvailabilityStatus

  return (
    <div className="space-y-6">
      {/* ── Identity: photo + name + sport/position + level + location ── */}
      <section className="space-y-4">
        <SectionHeader
          title="Basic info"
          label="Basic info"
          step={1}
          onEditStep={editStep}
        />
        <div className="flex items-start gap-4">
          {profile.profile_photo_url ? (
            // A-2: explicit 128×128 intrinsic size reserves the avatar's
            // footprint before the stored photo loads.
            <Image
              src={profile.profile_photo_url}
              alt={`${name} profile photo`}
              width={128}
              height={128}
              unoptimized={isRemoteImageSrc(profile.profile_photo_url)}
              className="size-32 shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex size-32 shrink-0 items-center justify-center rounded-full bg-muted text-large font-bold text-muted-foreground"
            >
              {initial}
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <h2 className="font-heading text-large font-semibold text-foreground">{name}</h2>
            {sportLine ? (
              <p className="text-medium text-muted-foreground">{sportLine}</p>
            ) : null}
            {profile.level ? (
              <div className="pt-1">
                <LevelChip level={humanise(profile.level)} />
              </div>
            ) : null}
            <p className="flex items-center gap-1 text-small text-muted-foreground">
              <MapPin aria-hidden="true" className="size-3.5" />
              {/* City only — country is never shown here (§3B.1). */}
              <span>{profile.home_city || 'Not set'}</span>
            </p>
            <p className="flex items-center gap-1 text-small text-muted-foreground">
              <Navigation aria-hidden="true" className="size-3.5" />
              <span>
                {typeof profile.travel_radius_km === 'number'
                  ? `Travels up to ${profile.travel_radius_km} km`
                  : 'Travel radius not set'}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Sport detail edit jump (level/position captured in step 2) ── */}
      <section className="flex items-center justify-between border-t pt-4">
        <h3 className="text-medium font-medium text-foreground">Sport</h3>
        <SectionEdit label="Sport" step={2} onEditStep={editStep} />
      </section>

      {/* ── Seeking chips (step 3). Per §3B.1 these precede socials. ── */}
      <section className="space-y-3 border-t pt-4">
        <SectionHeader
          title="Seeking"
          label="seeking"
          step={3}
          onEditStep={editStep}
        />
        {profile.seeking.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.seeking.map((s) => (
              <SeekingTag key={s}>{humanise(s)}</SeekingTag>
            ))}
          </div>
        ) : (
          <p className="text-small text-muted-foreground">Not currently seeking opportunities.</p>
        )}
      </section>

      {/* ── Connected socials with follower counts (step 4) ── */}
      <section className="space-y-3 border-t pt-4">
        <SectionHeader
          title="Socials"
          label="Socials"
          step={4}
          onEditStep={editStep}
        />
        {connectedSocials.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {connectedSocials.map(({ key, label, Icon, data }) => (
              <li key={key}>
                <a
                  href={data!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border bg-card px-3 py-2 text-small text-foreground transition-shadow hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span>{label}</span>
                  {data!.followers !== null ? (
                    <span className="font-medium text-foreground">
                      {formatFollowers(data!.followers)}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-muted-foreground">No social accounts connected.</p>
        )}
      </section>

      {/* ── Colour-coded availability badge (step 3) ── */}
      <section className="space-y-3 border-t pt-4">
        <SectionHeader
          title="Availability"
          label="availability status"
          step={3}
          onEditStep={editStep}
        />
        <AvailabilityBadge
          status={availabilityStatus}
          {...(profile.available_from_date ? { date: profile.available_from_date } : {})}
        />
      </section>

      {/* ── Action-photo thumbnail strip (media; step 4) ── */}
      <section className="space-y-3 border-t pt-4">
        <SectionHeader
          title="Photos"
          label="photos"
          step={4}
          onEditStep={editStep}
        />
        {profile.action_photos.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {profile.action_photos.map((src, i) => (
              <li key={src}>
                {/* A-2: explicit 80×80 intrinsic size + lazy loading. */}
                <Image
                  src={src}
                  alt={`${name} action photo ${i + 1}`}
                  width={80}
                  height={80}
                  loading="lazy"
                  unoptimized={isRemoteImageSrc(src)}
                  className="size-20 rounded-[var(--radius)] object-cover ring-1 ring-foreground/10"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-muted-foreground">No action photos added yet.</p>
        )}
      </section>
    </div>
  )
}
