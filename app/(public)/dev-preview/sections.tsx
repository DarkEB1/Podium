'use client'

/**
 * TEMP dev-only preview sections for /dev-preview. All data here is static
 * mock data; every rendered component is the real one imported from the app.
 */

import { useState } from 'react'

import SettingsForm from '@/components/athlete/settings-form'
import ProfileWizard from '@/components/athlete/profile-wizard'
import ProfileHero from '@/components/athlete/profile-hero'
import ProfileStatStrip from '@/components/athlete/profile-stat-strip'
import ProfileSeeking from '@/components/athlete/profile-seeking'
import ProfileGallery from '@/components/athlete/profile-gallery'
import ProfileSocialStrip from '@/components/athlete/profile-social-strip'
import { LevelChip } from '@/components/ui/status-badges'
import { CardSelectGroup } from '@/components/ui/card-select'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type SettingsRow = Database['public']['Tables']['profile_settings']['Row']

// --- Mock data --------------------------------------------------------------

const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001'

const MOCK_PROFILE: AthleteRow = {
  academy_club: null,
  action_photos: [],
  availability_status: 'available_now',
  available_from_date: null,
  chat_retention_days: null,
  created_at: '2026-08-01T00:00:00.000Z',
  date_of_birth: '2002-04-12',
  discovery_ui_mode: 'marketplace',
  display_name: 'Test Athlete',
  display_theme: 'light',
  full_legal_name: 'Testy Athlete-Legal',
  guardian_accepted_at: null,
  guardian_email: null,
  guardian_name: null,
  guardian_phone: null,
  guardian_relationship: null,
  has_agent: false,
  height_cm: 180,
  highest_level: null,
  highlight_videos: [],
  home_city: 'Leeds',
  home_country: 'GB',
  id: '00000000-0000-4000-8000-000000000002',
  is_seeking: true,
  is_under_18: false,
  last_active_at: '2026-08-14T09:00:00.000Z',
  level: 'semi_professional',
  national_programme: null,
  notable_achievements: null,
  notification_prefs: {},
  payout_account_holder: null,
  payout_account_last4: null,
  payout_bank_name: null,
  payout_country: null,
  payout_method: null,
  payout_sort_code_last4: null,
  performance_stats: {},
  phone: null,
  position: 'Sprinter',
  primary_sport: 'Sprint (100m)',
  profile_photo_url: null,
  secondary_sport: null,
  seeking: ['paid_partnership'],
  social_accounts: {
    instagram: 'testathlete',
    tiktok: 'https://tiktok.com/@testathlete',
    instagram_followers: 12400,
    tiktok_followers: 5200,
  },
  status: 'active',
  stripe_connect_account_id: null,
  stripe_connect_onboarded_at: null,
  stripe_connect_status: 'not_started',
  travel_radius_km: 50,
  university_city: 'Loughborough',
  university_country: 'GB',
  university_team: 'loughborough-university',
  updated_at: '2026-08-14T09:00:00.000Z',
  user_id: MOCK_USER_ID,
  weight_kg: 74,
  years_active: 6,
}

const MOCK_SETTINGS: SettingsRow = {
  created_at: '2026-08-01T00:00:00.000Z',
  discoverable: true,
  display_currency: 'gbp',
  email_digest: 'weekly',
  id: '00000000-0000-4000-8000-000000000003',
  location_precision: 'city',
  marketing_opt_in: false,
  notification_matrix: {
    new_match: { push: true, email: true },
    new_message: { push: true, in_app: true },
  },
  pause_matches: false,
  profile_visible: true,
  quiet_hours_end: '07:00',
  quiet_hours_start: '22:00',
  section_visibility: {},
  updated_at: '2026-08-14T09:00:00.000Z',
  user_id: MOCK_USER_ID,
}

// Inline SVG avatar so the hero has an avatar without any network dependency.
const MOCK_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">' +
      '<rect width="160" height="160" fill="#1d4ed8"/>' +
      '<text x="80" y="96" font-family="sans-serif" font-size="48" fill="#ffffff" text-anchor="middle">TA</text>' +
      '</svg>',
  )

// Mirrors the settings page: settings hosts the profile form in #profile.
const SETTINGS_HREF = '/athlete/settings#profile'

// Same option set the settings form feeds its seeking CardSelectGroup
// (component-specific display data, duplicated here as harness mock data).
const SEEKING_OPTIONS = [
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

const SECTIONS = [
  { id: 'settings-loaded', label: 'SettingsForm (loaded)' },
  { id: 'wizard', label: 'ProfileWizard' },
  { id: 'profile-view', label: 'Profile view (owner)' },
  { id: 'level-chip', label: 'LevelChip' },
  { id: 'seeking-grid', label: 'Seeking CardSelectGroup' },
]

// --- Harness chrome ---------------------------------------------------------

function SectionHeading({ id, title }: { id: string; title: string }) {
  return (
    <div className="mx-auto max-w-7xl px-6 md:px-16">
      <h2 className="border-b-2 border-primary pb-2 font-heading text-large font-semibold text-foreground">
        {title}
        <span className="ml-3 font-mono text-small font-normal text-muted-foreground">
          #{id}
        </span>
      </h2>
    </div>
  )
}

function VariantLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-mono text-small uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}

// --- Page body --------------------------------------------------------------

export default function DevPreviewSections() {
  const [seekingSelection, setSeekingSelection] = useState<string[]>([
    'paid_partnership',
    'product_gifting',
  ])

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      {/* Header + anchor nav */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8 md:px-16">
          <h1 className="font-heading text-display font-semibold">Dev preview</h1>
          <p className="mt-1 text-medium text-muted-foreground">
            Temporary component harness. Dev-only; 404s in production. All data is mock.
          </p>
          <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-full border px-3 py-1 text-small text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="space-y-24 pt-12">
        {/* 1 ── SettingsForm with a fully loaded profile + settings row */}
        <section id="settings-loaded" aria-label="SettingsForm loaded" className="space-y-6">
          <SectionHeading id="settings-loaded" title="SettingsForm, loaded state" />
          <SettingsForm profile={MOCK_PROFILE} settings={MOCK_SETTINGS} />
        </section>

        {/* 2 ── ProfileWizard as the onboarding page renders it */}
        <section id="wizard" aria-label="ProfileWizard" className="space-y-6">
          <SectionHeading id="wizard" title="ProfileWizard (onboarding step 1)" />
          {/* Same container the onboarding step page uses. */}
          <div className="mx-auto max-w-xl px-6 md:px-16">
            <ProfileWizard step={1} profile={MOCK_PROFILE} />
          </div>
        </section>

        {/* 2b ── Wizard step 2 with a BUCS-level profile so the university
            combobox, university city and country fields are visible */}
        <section id="wizard-step2" aria-label="ProfileWizard step 2" className="space-y-6">
          <SectionHeading id="wizard-step2" title="ProfileWizard (step 2, BUCS level)" />
          <div className="mx-auto max-w-xl px-6 md:px-16">
            <ProfileWizard step={2} profile={{ ...MOCK_PROFILE, level: 'university_bucs' }} />
          </div>
        </section>

        {/* 2c ── Wizard step 4 socials, prefilled with a legacy URL to verify
            the @handle prefill and validation */}
        <section id="wizard-step4" aria-label="ProfileWizard step 4" className="space-y-6">
          <SectionHeading id="wizard-step4" title="ProfileWizard (step 4, socials)" />
          <div className="mx-auto max-w-xl px-6 md:px-16">
            <ProfileWizard step={4} profile={MOCK_PROFILE} />
          </div>
        </section>

        {/* 3 ── Public profile page composition, owner view */}
        <section id="profile-view" aria-label="Profile view owner" className="space-y-6">
          <SectionHeading id="profile-view" title="Profile view (owner, static props)" />

          <ProfileHero
            avatar={MOCK_AVATAR}
            name="Test Athlete"
            tagline="Sprint (100m) · Semi-Professional"
            location="Leeds, United Kingdom"
            verified={false}
            availability={{ status: 'available_now' }}
          />

          <div className="mx-auto mt-12 max-w-5xl space-y-16 px-6 md:px-16">
            {/* Fed exactly as the page feeds it: followers present (Self-reported
                caption), engagement absent (owner sees the Add socials link). */}
            <ProfileStatStrip
              followers="12.4K"
              engagement={null}
              sport="Sprint (100m)"
              level="Semi-Professional"
              isOwner
              settingsHref={SETTINGS_HREF}
            />

            <div className="space-y-4">
              <h3 className="font-heading text-large font-semibold text-foreground">
                Seeking, three states
              </h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <VariantLabel>seeking on, with tags</VariantLabel>
                  <ProfileSeeking
                    seeking={['paid_partnership', 'product_gifting', 'event_appearance']}
                    isSeeking
                  />
                </div>
                <div>
                  <VariantLabel>seeking on, empty, owner</VariantLabel>
                  <ProfileSeeking seeking={[]} isSeeking isOwner />
                </div>
                <div>
                  <VariantLabel>seeking off, owner</VariantLabel>
                  <ProfileSeeking seeking={[]} isSeeking={false} isOwner />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-heading text-large font-semibold text-foreground">
                Gallery, empty, owner
              </h3>
              <ProfileGallery
                name="Test Athlete"
                photos={[]}
                isOwner
                manageHref={SETTINGS_HREF}
              />
            </div>

            <div className="space-y-4">
              <h3 className="font-heading text-large font-semibold text-foreground">
                Social strip
              </h3>
              <VariantLabel>with accounts</VariantLabel>
              <ProfileSocialStrip
                accounts={{ instagram: 'testathlete', twitter: 'https://x.com/testathlete' }}
              />
              <VariantLabel>empty, owner</VariantLabel>
              <ProfileSocialStrip accounts={{}} isOwner connectHref={SETTINGS_HREF} />
            </div>
          </div>
        </section>

        {/* 4 ── LevelChip width behaviour */}
        <section id="level-chip" aria-label="LevelChip" className="space-y-6">
          <SectionHeading id="level-chip" title="LevelChip, constrained vs free" />
          <div className="mx-auto max-w-7xl px-6 md:px-16">
            <div className="flex items-start gap-8">
              <div>
                <VariantLabel>140px container</VariantLabel>
                <div className="flex w-[140px] border border-dashed border-muted-foreground/40 p-1">
                  <LevelChip level="Semi-Professional" />
                </div>
              </div>
              <div>
                <VariantLabel>unconstrained</VariantLabel>
                <div className="inline-flex border border-dashed border-muted-foreground/40 p-1">
                  <LevelChip level="Semi-Professional" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5 ── Seeking CardSelectGroup in the settings content column */}
        <section id="seeking-grid" aria-label="Seeking CardSelectGroup" className="space-y-6">
          <SectionHeading id="seeking-grid" title="Seeking CardSelectGroup, settings column" />
          {/* Mirrors SettingsShell: max-w-7xl page container, 16rem rail + 1fr
              content column from lg, so the intrinsic grid is inspected at the
              exact width the settings page gives it. */}
          <div className="mx-auto max-w-7xl px-6 md:px-16">
            <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
              <div
                aria-hidden="true"
                className="hidden rounded-xl border border-dashed border-muted-foreground/30 p-3 text-small text-muted-foreground lg:block"
              >
                nav rail placeholder (16rem)
              </div>
              <div className="min-w-0">
                <p className="mb-2 text-medium font-medium">What you&apos;re seeking</p>
                <CardSelectGroup
                  options={SEEKING_OPTIONS}
                  value={seekingSelection}
                  onChange={setSeekingSelection}
                  multiple
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
