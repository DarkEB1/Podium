'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Combobox } from '@/components/ui/combobox'
import { CardSelectGroup } from '@/components/ui/card-select'
import { ImageUpload } from '@/components/ui/image-upload'
import { CharacterCounter } from '@/components/ui/character-counter'
import SettingsShell from '@/components/layout/settings-shell'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/supabase/settings'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type SettingsRow = Database['public']['Tables']['profile_settings']['Row']
type AthleteLevel = Database['public']['Enums']['athlete_level']
type AvailabilityStatus = Database['public']['Enums']['availability_status']
type SeekingType = Database['public']['Enums']['seeking_type']
type UiMode = Database['public']['Enums']['ui_mode']

// --- Display labels (component-specific UI data) --------------------------

const LEVEL_OPTIONS: { value: AthleteLevel; label: string }[] = [
  { value: 'recreational', label: 'Recreational' },
  { value: 'amateur', label: 'Amateur' },
  { value: 'semi_professional', label: 'Semi-Professional' },
  { value: 'university_bucs', label: 'University / BUCS' },
  { value: 'academy', label: 'Academy' },
  { value: 'national', label: 'National' },
  { value: 'professional', label: 'Professional' },
  { value: 'international', label: 'International' },
]

const SEEKING_OPTIONS: { value: SeekingType; label: string; description: string }[] = [
  { value: 'product_gifting', label: 'Product Gifting', description: 'Free products to showcase' },
  { value: 'paid_partnership', label: 'Paid Partnership', description: 'Paid promotional deals' },
  { value: 'brand_ambassador', label: 'Brand Ambassador', description: 'Long-term representation' },
  { value: 'social_content', label: 'Social Content', description: 'Posts, reels and stories' },
  { value: 'event_appearance', label: 'Event Appearance', description: 'Show up at brand events' },
  { value: 'affiliate_code', label: 'Affiliate Code', description: 'Commission on referrals' },
  { value: 'equipment_sponsorship', label: 'Equipment Sponsorship', description: 'Gear and kit deals' },
  { value: 'nutrition_supplement', label: 'Nutrition / Supplement', description: 'Food and supplement brands' },
  { value: 'apparel_deal', label: 'Apparel Deal', description: 'Clothing and footwear' },
  { value: 'university_nil_collective', label: 'University NIL Collective', description: 'NIL collective deals' },
]

const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available_now: 'Available Now',
  available_from: 'Available From',
  not_available: 'Not Available',
}

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'visibility', label: 'Visibility & Discovery' },
]

// --- Profile completeness -------------------------------------------------

interface CompletenessField {
  done: boolean
  prompt: string
}

function buildCompleteness(profile: AthleteRow): {
  pct: number
  prompts: string[]
} {
  const fields: CompletenessField[] = [
    { done: Boolean(profile.profile_photo_url), prompt: 'Add a profile photo' },
    { done: Boolean(profile.display_name), prompt: 'Add your display name' },
    { done: Boolean(profile.primary_sport), prompt: 'Add your primary sport' },
    { done: Boolean(profile.level), prompt: 'Set your competition level' },
    { done: (profile.action_photos?.length ?? 0) > 0, prompt: 'Add action photos' },
    { done: (profile.highlight_videos?.length ?? 0) > 0, prompt: 'Add a highlight video' },
    { done: Object.keys((profile.social_accounts as object) ?? {}).length > 0, prompt: 'Link a social account' },
    { done: Object.keys((profile.performance_stats as object) ?? {}).length > 0, prompt: 'Add performance stats' },
    { done: Boolean(profile.notable_achievements), prompt: 'List a notable achievement' },
  ]
  const done = fields.filter((f) => f.done).length
  const pct = Math.round((done / fields.length) * 100)
  const prompts = fields.filter((f) => !f.done).map((f) => f.prompt)
  return { pct, prompts }
}

// --- Component ------------------------------------------------------------

interface Props {
  profile: AthleteRow
  /**
   * profile_settings row. Optional so the existing settings page (which only
   * loads the athlete profile) keeps compiling; falls back to sensible visible
   * defaults until the page is wired to pass the row.
   */
  settings?: SettingsRow | null
}

const DEFAULT_VISIBILITY = { profile_visible: true, pause_matches: false }

export default function SettingsForm({ profile, settings }: Props) {
  const visibility = {
    profile_visible: settings?.profile_visible ?? DEFAULT_VISIBILITY.profile_visible,
    pause_matches: settings?.pause_matches ?? DEFAULT_VISIBILITY.pause_matches,
  }
  // Section 1 — Profile (persists to athlete_profiles via /api/profiles/me).
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.profile_photo_url)
  const [actionPhotos, setActionPhotos] = useState<string[]>(profile.action_photos ?? [])
  const [videos, setVideos] = useState<string[]>(profile.highlight_videos ?? [])
  const [primarySport, setPrimarySport] = useState(profile.primary_sport ?? '')
  const [level, setLevel] = useState<string | null>(profile.level)
  const [instagram, setInstagram] = useState(
    ((profile.social_accounts as Record<string, string>)?.instagram as string) ?? '',
  )
  const [statLabel, setStatLabel] = useState('')
  const [statValue, setStatValue] = useState('')
  const [stats, setStats] = useState<Record<string, string>>(
    (profile.performance_stats as Record<string, string>) ?? {},
  )
  const [achievements, setAchievements] = useState(profile.notable_achievements ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Section 2 — Visibility & Discovery.
  // profile_visible / pause_matches live on profile_settings (updateSettings, B9).
  // travel radius / availability / discovery mode / seeking live on athlete_profiles.
  const [profileVisible, setProfileVisible] = useState(visibility.profile_visible)
  const [pauseMatches, setPauseMatches] = useState(visibility.pause_matches)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [seeking, setSeeking] = useState<string[]>(profile.seeking ?? [])
  const [travelRadius, setTravelRadius] = useState(profile.travel_radius_km ?? 50)
  const [availability, setAvailability] = useState<AvailabilityStatus>(
    profile.availability_status ?? 'available_now',
  )
  const [availableFrom, setAvailableFrom] = useState(profile.available_from_date ?? '')
  const [uiMode, setUiMode] = useState<UiMode>(profile.discovery_ui_mode)
  const [savingDiscovery, setSavingDiscovery] = useState(false)

  const completeness = useMemo(
    () => buildCompleteness({ ...profile, profile_photo_url: photoUrl }),
    [profile, photoUrl],
  )

  async function patchProfile(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch('/api/profiles/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error(data?.error?.message ?? 'Failed to save')
      return false
    }
    return true
  }

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const ok = await patchProfile({
        display_name: displayName,
        profile_photo_url: photoUrl,
        action_photos: actionPhotos,
        highlight_videos: videos,
        primary_sport: primarySport,
        level,
        social_accounts: { ...(profile.social_accounts as object), instagram },
        performance_stats: stats,
        notable_achievements: achievements,
      })
      if (ok) toast.success('Profile saved')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function toggleSetting(
    key: 'profile_visible' | 'pause_matches',
    next: boolean,
  ) {
    // Optimistic UI; revert on failure.
    if (key === 'profile_visible') setProfileVisible(next)
    else setPauseMatches(next)
    setSavingVisibility(true)
    try {
      await updateSettings(createClient(), profile.user_id, { [key]: next })
      toast.success('Settings saved')
    } catch {
      if (key === 'profile_visible') setProfileVisible(!next)
      else setPauseMatches(!next)
      toast.error('Failed to save setting')
    } finally {
      setSavingVisibility(false)
    }
  }

  async function saveDiscovery() {
    setSavingDiscovery(true)
    try {
      const ok = await patchProfile({
        seeking,
        travel_radius_km: travelRadius,
        availability_status: availability,
        available_from_date: availability === 'available_from' ? availableFrom || null : null,
        discovery_ui_mode: uiMode,
      })
      if (ok) toast.success('Discovery preferences saved')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSavingDiscovery(false)
    }
  }

  function addStat() {
    const label = statLabel.trim()
    const value = statValue.trim()
    if (!label || !value) return
    setStats((prev) => ({ ...prev, [label]: value }))
    setStatLabel('')
    setStatValue('')
  }

  return (
    <SettingsShell sections={SECTIONS} active="profile">
      <div className="space-y-12">
        {/* ---------------- Section 1: Profile ---------------- */}
        <section id="profile" aria-labelledby="profile-heading" className="space-y-6">
          <h2 id="profile-heading" className="text-large font-heading">
            Profile
          </h2>

          {/* Completeness meter + prompts */}
          <div className="rounded-[var(--radius)] border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-medium font-medium">Profile completeness</span>
              <span className="text-small tabular-nums text-muted-foreground">
                {completeness.pct}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Profile completeness"
              aria-valuenow={completeness.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completeness.pct}%` }}
              />
            </div>
            {completeness.prompts.length > 0 && (
              <ul className="mt-3 space-y-1 text-small text-muted-foreground">
                {completeness.prompts.map((prompt) => (
                  <li key={prompt}>• {prompt}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Photo */}
          <div>
            <p className="mb-2 text-medium font-medium">Profile photo</p>
            <ImageUpload
              value={photoUrl}
              onUploaded={setPhotoUrl}
              aspect={1}
              shape="circle"
              label="Change photo"
              subtext="Square image, min 500px"
            />
          </div>

          {/* Display name */}
          <div>
            <label htmlFor="display_name" className="mb-1 block text-medium font-medium">
              Display name
            </label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Sport + Level */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="primary_sport" className="mb-1 block text-medium font-medium">
                Primary sport
              </label>
              <Input
                id="primary_sport"
                value={primarySport}
                onChange={(e) => setPrimarySport(e.target.value)}
              />
            </div>
            <div>
              <span className="mb-1 block text-medium font-medium" id="level-label">
                Competition level
              </span>
              <Combobox
                aria-label="Competition level"
                options={LEVEL_OPTIONS}
                value={level}
                onChange={setLevel}
                placeholder="Select level"
              />
            </div>
          </div>

          {/* Action photos */}
          <div>
            <p className="mb-2 text-medium font-medium">Action photos</p>
            <ImageUpload
              value={null}
              onUploaded={(url) => setActionPhotos((prev) => [...prev, url])}
              aspect={4 / 3}
              shape="square"
              label="Add action photo"
            />
            {actionPhotos.length > 0 && (
              <ul className="mt-2 space-y-1 text-small text-muted-foreground">
                {actionPhotos.map((url, i) => (
                  <li key={url} className="flex items-center justify-between gap-2">
                    <span className="truncate">Photo {i + 1}</span>
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      onClick={() => setActionPhotos((prev) => prev.filter((p) => p !== url))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Highlight videos */}
          <div>
            <label htmlFor="add_video" className="mb-1 block text-medium font-medium">
              Highlight videos
            </label>
            <div className="flex gap-2">
              <Input
                id="add_video"
                placeholder="Paste a video URL"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const url = (e.target as HTMLInputElement).value.trim()
                    if (url) {
                      setVideos((prev) => [...prev, url])
                      ;(e.target as HTMLInputElement).value = ''
                    }
                  }
                }}
              />
            </div>
            {videos.length > 0 && (
              <ul className="mt-2 space-y-1 text-small text-muted-foreground">
                {videos.map((url) => (
                  <li key={url} className="flex items-center justify-between gap-2">
                    <span className="truncate">{url}</span>
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      onClick={() => setVideos((prev) => prev.filter((v) => v !== url))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Socials */}
          <div>
            <label htmlFor="instagram" className="mb-1 block text-medium font-medium">
              Instagram handle
            </label>
            <Input
              id="instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@yourhandle"
            />
          </div>

          {/* Performance stats */}
          <div>
            <p className="mb-2 text-medium font-medium">Performance stats</p>
            {Object.keys(stats).length > 0 && (
              <ul className="mb-2 space-y-1 text-small">
                {Object.entries(stats).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="text-muted-foreground">{k}:</span> {v}
                    </span>
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      onClick={() =>
                        setStats((prev) => {
                          const next = { ...prev }
                          delete next[k]
                          return next
                        })
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                aria-label="Stat label"
                placeholder="Label (e.g. 100m PB)"
                value={statLabel}
                onChange={(e) => setStatLabel(e.target.value)}
              />
              <Input
                aria-label="Stat value"
                placeholder="Value (e.g. 10.4s)"
                value={statValue}
                onChange={(e) => setStatValue(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={addStat}>
                Add
              </Button>
            </div>
          </div>

          {/* Achievements */}
          <div>
            <label htmlFor="achievements" className="mb-1 block text-medium font-medium">
              Notable achievements
            </label>
            <Textarea
              id="achievements"
              rows={4}
              className="resize-none"
              maxLength={600}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
            />
            <CharacterCounter value={achievements} max={600} />
          </div>

          <Button type="button" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </section>

        {/* -------------- Section 2: Visibility & Discovery -------------- */}
        <section
          id="visibility"
          role="region"
          aria-labelledby="visibility-heading"
          className="space-y-6 border-t pt-8"
        >
          <h2 id="visibility-heading" className="text-large font-heading">
            Visibility &amp; Discovery
          </h2>

          {/* Visibility toggle + explanation */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-medium font-medium" id="visibility-toggle-label">
                Profile visible
              </p>
              <p className="text-small text-muted-foreground">
                When on, your profile is visible in discovery and brands can find and contact you.
              </p>
            </div>
            <Switch
              aria-labelledby="visibility-toggle-label"
              aria-label="Profile visible"
              checked={profileVisible}
              disabled={savingVisibility}
              onCheckedChange={(next) => toggleSetting('profile_visible', next)}
            />
          </div>

          {/* Pause matches toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-medium font-medium" id="pause-toggle-label">
                Pause matches
              </p>
              <p className="text-small text-muted-foreground">
                Temporarily stop new match suggestions without hiding your profile.
              </p>
            </div>
            <Switch
              aria-labelledby="pause-toggle-label"
              aria-label="Pause matches"
              checked={pauseMatches}
              disabled={savingVisibility}
              onCheckedChange={(next) => toggleSetting('pause_matches', next)}
            />
          </div>

          {/* Discovery interests (seeking) */}
          <div>
            <p className="mb-2 text-medium font-medium">What you&apos;re seeking</p>
            <CardSelectGroup
              options={SEEKING_OPTIONS}
              value={seeking}
              onChange={setSeeking}
              multiple
            />
          </div>

          {/* Travel radius */}
          <div>
            <label className="mb-1 block text-medium font-medium" htmlFor="travel-radius">
              Travel radius
            </label>
            <Slider
              min={0}
              max={500}
              step={5}
              value={travelRadius}
              onChange={setTravelRadius}
              format={(n) => `${n} km`}
            />
          </div>

          {/* Availability + conditional date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="availability" className="mb-1 block text-medium font-medium">
                Availability
              </label>
              <select
                id="availability"
                value={availability}
                onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}
                className="h-9 w-full rounded-[var(--radius)] border bg-card px-3 text-medium"
              >
                {(Object.keys(AVAILABILITY_LABELS) as AvailabilityStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {AVAILABILITY_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            {availability === 'available_from' && (
              <div>
                <label htmlFor="available_from" className="mb-1 block text-medium font-medium">
                  Available from date
                </label>
                <Input
                  id="available_from"
                  type="date"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Discovery mode (marketplace / swipe) */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-medium font-medium" id="mode-toggle-label">
                Swipe mode
              </p>
              <p className="text-small text-muted-foreground">
                Browse one profile at a time instead of the marketplace grid.
              </p>
            </div>
            <Switch
              aria-labelledby="mode-toggle-label"
              aria-label="Swipe mode"
              checked={uiMode === 'swipe'}
              onCheckedChange={(next) => setUiMode(next ? 'swipe' : 'marketplace')}
            />
          </div>

          <Button type="button" onClick={saveDiscovery} disabled={savingDiscovery}>
            {savingDiscovery ? 'Saving…' : 'Save discovery'}
          </Button>
        </section>
      </div>
    </SettingsShell>
  )
}
