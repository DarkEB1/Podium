'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { CharacterCounter } from '@/components/ui/character-counter'
import { VerifiedBadge } from '@/components/ui/status-badges'
import SettingsShell from '@/components/layout/settings-shell'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/supabase/settings'
import type { Database } from '@/types/database'

type AgentRow = Database['public']['Tables']['agent_profiles']['Row']
type SettingsRow = Database['public']['Tables']['profile_settings']['Row']

const BIO_MAX = 1000

const SECTIONS = [
  { id: 'profile', label: 'Agency profile' },
  { id: 'visibility', label: 'Visibility & notifications' },
]

interface Props {
  profile: AgentRow
  /**
   * profile_settings row. Optional so callers that have not yet loaded it keep
   * compiling; falls back to visible defaults until the row is supplied.
   */
  settings?: SettingsRow | null
}

const DEFAULTS = { profile_visible: true, discoverable: true, marketing_opt_in: false }

export default function AgentSettingsForm({ profile, settings }: Props) {
  // Section 1 — Agency profile (persists to agent_profiles via /api/profiles/me).
  const [agencyName, setAgencyName] = useState(profile.agency_name ?? '')
  const [agentFullName, setAgentFullName] = useState(profile.agent_full_name ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Section 2 — Visibility & notifications (persists to profile_settings, B9).
  const [profileVisible, setProfileVisible] = useState(
    settings?.profile_visible ?? DEFAULTS.profile_visible,
  )
  const [discoverable, setDiscoverable] = useState(
    settings?.discoverable ?? DEFAULTS.discoverable,
  )
  const [marketingOptIn, setMarketingOptIn] = useState(
    settings?.marketing_opt_in ?? DEFAULTS.marketing_opt_in,
  )
  const [savingSetting, setSavingSetting] = useState(false)

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_name: agencyName,
          agent_full_name: agentFullName,
          website_url: websiteUrl,
          linkedin_url: linkedinUrl,
          bio,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error?.message ?? 'Failed to save')
        return
      }
      toast.success('Profile saved')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function toggleSetting(
    key: 'profile_visible' | 'discoverable' | 'marketing_opt_in',
    next: boolean,
  ) {
    // Optimistic UI; revert on failure.
    const setters: Record<typeof key, (v: boolean) => void> = {
      profile_visible: setProfileVisible,
      discoverable: setDiscoverable,
      marketing_opt_in: setMarketingOptIn,
    }
    setters[key](next)
    setSavingSetting(true)
    try {
      await updateSettings(createClient(), profile.user_id, { [key]: next })
      toast.success('Settings saved')
    } catch {
      setters[key](!next)
      toast.error('Failed to save setting')
    } finally {
      setSavingSetting(false)
    }
  }

  return (
    <SettingsShell sections={SECTIONS} active="profile">
      <div className="space-y-12">
        {/* ---------------- Section 1: Agency profile ---------------- */}
        <section id="profile" aria-labelledby="agent-profile-heading" className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="agent-profile-heading" className="text-large font-heading">
              Agency profile
            </h2>
            <VerifiedBadge verified={profile.verification_status === 'verified'} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="agency_name" className="mb-1 block text-medium font-medium">
                Agency name
              </label>
              <Input
                id="agency_name"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="agent_full_name" className="mb-1 block text-medium font-medium">
                Your full name
              </label>
              <Input
                id="agent_full_name"
                value={agentFullName}
                onChange={(e) => setAgentFullName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="website_url" className="mb-1 block text-medium font-medium">
                Website{' '}
                <span className="text-small text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="website_url"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
            <div>
              <label htmlFor="linkedin_url" className="mb-1 block text-medium font-medium">
                LinkedIn{' '}
                <span className="text-small text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="linkedin_url"
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bio" className="mb-1 block text-medium font-medium">
              About your agency{' '}
              <span className="text-small text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="bio"
              rows={4}
              className="resize-none"
              maxLength={BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <CharacterCounter value={bio} max={BIO_MAX} />
          </div>

          <Button type="button" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </section>

        {/* -------------- Section 2: Visibility & notifications -------------- */}
        <section
          id="visibility"
          role="region"
          aria-labelledby="agent-visibility-heading"
          className="space-y-6 border-t border-border pt-8"
        >
          <h2 id="agent-visibility-heading" className="text-large font-heading">
            Visibility &amp; notifications
          </h2>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-medium font-medium" id="agent-visible-label">
                Profile visible
              </p>
              <p className="text-small text-muted-foreground">
                When on, your agency profile is visible to athletes and brands.
              </p>
            </div>
            <Switch
              aria-labelledby="agent-visible-label"
              aria-label="Profile visible"
              checked={profileVisible}
              disabled={savingSetting}
              onCheckedChange={(next) => toggleSetting('profile_visible', next)}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-medium font-medium" id="agent-discoverable-label">
                Discoverable
              </p>
              <p className="text-small text-muted-foreground">
                Allow your agency to appear in discovery search results.
              </p>
            </div>
            <Switch
              aria-labelledby="agent-discoverable-label"
              aria-label="Discoverable"
              checked={discoverable}
              disabled={savingSetting}
              onCheckedChange={(next) => toggleSetting('discoverable', next)}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-medium font-medium" id="agent-marketing-label">
                Marketing emails
              </p>
              <p className="text-small text-muted-foreground">
                Receive product updates and occasional marketing emails from Podium.
              </p>
            </div>
            <Switch
              aria-labelledby="agent-marketing-label"
              aria-label="Marketing emails"
              checked={marketingOptIn}
              disabled={savingSetting}
              onCheckedChange={(next) => toggleSetting('marketing_opt_in', next)}
            />
          </div>
        </section>
      </div>
    </SettingsShell>
  )
}
