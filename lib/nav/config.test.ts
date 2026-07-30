import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  NAV_ROLES,
  navItemsForRole,
  ctaForRole,
  bottomNavForRole,
  buildBreadcrumbs,
  humaniseSegment,
  isActiveHref,
  athleteResumeStep,
  brandResumeStep,
  roleResumeStep,
  onboardingResumePath,
  isOnboardingComplete,
  ONBOARDING_STEPS,
  ONBOARDING_PROGRESS_COLUMNS,
} from './config'

const APP_DIR = path.resolve(__dirname, '..', '..', 'app')

/** Real, statically-addressable routes derived from the app/ tree. */
function collectRoutes(dir: string, segments: string[] = []): string[] {
  const found: string[] = []
  const entries = readdirSync(dir)
  if (
    (entries.includes('page.tsx') || entries.includes('route.ts')) &&
    !segments.some((s) => s.startsWith('['))
  ) {
    found.push('/' + segments.join('/'))
  }
  for (const entry of entries) {
    const full = path.join(dir, entry)
    if (!statSync(full).isDirectory()) continue
    if (/^\(.*\)$/.test(entry)) found.push(...collectRoutes(full, segments))
    else if (!entry.startsWith('_')) found.push(...collectRoutes(full, [...segments, entry]))
  }
  return found
}

const realRoutes = new Set(collectRoutes(APP_DIR))

describe('nav config', () => {
  it('defines exactly four roles', () => {
    expect([...NAV_ROLES].sort()).toEqual(['agent', 'athlete', 'brand', 'team'])
  })

  it('gives every role exactly four top-level items', () => {
    for (const role of NAV_ROLES) {
      expect(navItemsForRole(role)).toHaveLength(4)
    }
  })

  it('every item has a label, a role-scoped href, and an icon', () => {
    for (const role of NAV_ROLES) {
      for (const item of navItemsForRole(role)) {
        expect(item.label).toBeTruthy()
        expect(item.href.startsWith(`/${role}/`)).toBe(true)
        expect(item.icon).toBeTruthy()
      }
    }
  })

  // B-4: every primary nav destination used to be allowed to 404.
  it('points every nav item at a route that exists', () => {
    for (const role of NAV_ROLES) {
      for (const item of navItemsForRole(role)) {
        expect(realRoutes.has(item.href), `${role} → ${item.label} (${item.href})`).toBe(true)
      }
    }
  })

  it('gives every role a persistent CTA with a role-scoped href that exists', () => {
    for (const role of NAV_ROLES) {
      const cta = ctaForRole(role)
      expect(cta.label).toBeTruthy()
      expect(cta.href.startsWith(`/${role}/`)).toBe(true)
      expect(realRoutes.has(cta.href), `${role} CTA → ${cta.href}`).toBe(true)
    }
  })

  it("uses the brand CTA 'Post a Listing'", () => {
    expect(ctaForRole('brand').label).toMatch(/post a listing/i)
  })

  // B-6 / UX-2: the athlete's second slot was labelled "Listings" but opened
  // /athlete/requests, so connection requests were undiscoverable.
  it('labels the athlete requests destination "Requests"', () => {
    const item = navItemsForRole('athlete')[1]
    expect(item?.label).toBe('Requests')
    expect(item?.href).toBe('/athlete/requests')
  })

  it('never labels a nav item with a word absent from its own destination', () => {
    for (const role of NAV_ROLES) {
      for (const item of navItemsForRole(role)) {
        const slug = item.label.toLowerCase().replace(/\s+/g, '-')
        expect(item.href.toLowerCase(), `${role} → ${item.label}`).toContain(slug)
      }
    }
  })

  it('exposes the four top-level items as the mobile bottom nav', () => {
    for (const role of NAV_ROLES) {
      const bottom = bottomNavForRole(role)
      expect(bottom).toHaveLength(4)
      expect(bottom.map((i) => i.href)).toEqual(
        navItemsForRole(role).map((i) => i.href),
      )
      for (const item of bottom) {
        expect(item.icon).toBeTruthy()
      }
    }
  })

  it('marks the start route as active and ancestors via prefix match', () => {
    expect(isActiveHref('/athlete/discover', '/athlete/discover')).toBe(true)
    expect(isActiveHref('/athlete/discover/123', '/athlete/discover')).toBe(true)
    expect(isActiveHref('/athlete/profile', '/athlete/discover')).toBe(false)
  })

  it('humanises path segments', () => {
    expect(humaniseSegment('discover')).toBe('Discover')
    expect(humaniseSegment('edit-profile')).toBe('Edit Profile')
  })

  it('builds breadcrumbs from a pathname with cumulative hrefs', () => {
    const crumbs = buildBreadcrumbs('/athlete/profile/edit')
    expect(crumbs).toEqual([
      { label: 'Athlete', href: '/athlete' },
      { label: 'Profile', href: '/athlete/profile' },
      { label: 'Edit', href: '/athlete/profile/edit' },
    ])
  })

  it('returns no breadcrumbs for the root path', () => {
    expect(buildBreadcrumbs('/')).toEqual([])
  })
})

describe('onboarding resumption (PR-9)', () => {
  it('starts a brand new athlete at step 1', () => {
    expect(athleteResumeStep(null)).toBe(1)
    expect(athleteResumeStep({})).toBe(1)
  })

  it('stays on step 1 until every mandatory basic is present', () => {
    expect(
      athleteResumeStep({ display_name: 'Maya', home_country: 'GB', profile_photo_url: null }),
    ).toBe(1)
  })

  const basics = { display_name: 'Maya', home_country: 'GB', profile_photo_url: 'https://x/y.jpg' }

  it('resumes at the furthest incomplete step, never restarting', () => {
    expect(athleteResumeStep(basics)).toBe(2)
    expect(athleteResumeStep({ ...basics, primary_sport: 'Athletics' })).toBe(3)
    expect(
      athleteResumeStep({ ...basics, primary_sport: 'Athletics', availability_status: 'available_now' }),
    ).toBe(4)
  })

  it('sends a fully-filled draft to the review step', () => {
    expect(
      athleteResumeStep({
        ...basics,
        primary_sport: 'Athletics',
        availability_status: 'available_now',
        social_accounts: { instagram: 'https://instagram.com/maya' },
      }),
    ).toBe(6)
  })

  it('maps each role to a real onboarding route', () => {
    expect(onboardingResumePath('athlete', basics)).toBe('/athlete/onboarding/step/2')
    // Athlete and brand resume into their `step/[step]` route, which is dynamic
    // and therefore not in `realRoutes` (that set only holds static paths); the
    // parent segment is what must exist.
    expect(onboardingResumePath('brand', null)).toBe('/brand/onboarding/step/1')
    expect(realRoutes.has('/brand/onboarding')).toBe(true)
    // Single-form roles resume at the form itself — a real static route.
    expect(realRoutes.has(onboardingResumePath('team', null))).toBe(true)
    expect(realRoutes.has(onboardingResumePath('agent', null))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// PR-9 — partial progress must be resumable for EVERY role, not just athletes
// ---------------------------------------------------------------------------

describe('brand onboarding resumption (PR-9)', () => {
  const step1Done = { company_name: 'Acme', cover_image_url: 'https://x/cover.jpg' }

  it('starts a brand with no row, and one with no basics, at step 1', () => {
    expect(brandResumeStep(null)).toBe(1)
    expect(brandResumeStep({})).toBe(1)
    expect(brandResumeStep({ company_name: 'Acme' })).toBe(1)
    expect(brandResumeStep({ cover_image_url: 'https://x/cover.jpg' })).toBe(1)
  })

  // The regression: brands used to be sent to `/brand/onboarding`, which
  // redirects to step 1, so every partially-complete brand restarted.
  it('resumes at the furthest incomplete step, never restarting', () => {
    expect(brandResumeStep(step1Done)).toBe(2)
    expect(brandResumeStep({ ...step1Done, industry: 'sport' })).toBe(3)
    expect(brandResumeStep({ ...step1Done, industry: 'sport', description: 'We make shoes' })).toBe(4)
  })

  it('accepts any targeting column as evidence step 2 was completed', () => {
    for (const targeting of [
      { industry: 'sport' },
      { target_level: 'elite' },
      { geographic_preference: 'UK' },
      { target_sports: ['Football'] },
      { seeking: ['ambassador'] },
    ]) {
      expect(brandResumeStep({ ...step1Done, ...targeting })).toBe(3)
    }
  })

  it('ignores empty strings and empty arrays', () => {
    expect(brandResumeStep({ ...step1Done, industry: '', target_sports: [], seeking: [] })).toBe(2)
    expect(brandResumeStep({ ...step1Done, industry: 'sport', description: '   ' })).toBe(3)
  })

  it('routes a partially-complete brand to its step route', () => {
    expect(onboardingResumePath('brand', { ...step1Done, industry: 'sport' })).toBe(
      '/brand/onboarding/step/3',
    )
  })
})

describe('single-form roles (PR-9)', () => {
  // Honest answer: team and agent onboarding are single forms with no
  // `step/[step]` route and no per-step persistence, so there is no step to
  // resume at. `ONBOARDING_STEPS` records that explicitly rather than the code
  // pretending steps exist.
  it('declares that team and agent have no addressable steps', () => {
    expect(ONBOARDING_STEPS.team).toBeNull()
    expect(ONBOARDING_STEPS.agent).toBeNull()
    expect(ONBOARDING_STEPS.athlete).toBe(6)
    expect(ONBOARDING_STEPS.brand).toBe(4)
  })

  it('returns no resume step for the single-form roles', () => {
    expect(roleResumeStep('team', { company_name: 'X' })).toBeNull()
    expect(roleResumeStep('agent', null)).toBeNull()
  })

  it('still resumes them at their form rather than anywhere else', () => {
    expect(onboardingResumePath('team', null)).toBe('/team/onboarding')
    expect(onboardingResumePath('agent', null)).toBe('/agent/onboarding')
  })
})

describe('isOnboardingComplete', () => {
  // The regression this guards: one shared `status !== 'draft'` expression was
  // applied to all four role tables. It was right for exactly one of them.
  it('treats a missing profile row as incomplete for every role', () => {
    for (const role of NAV_ROLES) {
      expect(isOnboardingComplete(role, null)).toBe(false)
    }
  })

  describe('athlete and the single-form roles use status', () => {
    it.each(['athlete', 'team', 'agent'] as const)('%s in draft is incomplete', (role) => {
      expect(isOnboardingComplete(role, { status: 'draft' })).toBe(false)
    })

    it.each(['athlete', 'team', 'agent'] as const)('%s that is active is complete', (role) => {
      expect(isOnboardingComplete(role, { status: 'active' })).toBe(true)
    })

    // A profile taken down later is not an unfinished profile. Sending a
    // deactivated athlete back through the wizard would be a second bug.
    it.each(['athlete', 'team', 'agent'] as const)('%s that is deactivated is still complete', (role) => {
      expect(isOnboardingComplete(role, { status: 'deactivated' })).toBe(true)
    })
  })

  describe('brand uses its own completion marker', () => {
    // brand_status is ('pending_approval','active','suspended','rejected') —
    // there is no 'draft', so `status !== 'draft'` was true the instant step 1
    // inserted the row and the gate never asked for steps 2 to 4.
    const midWizard = {
      status: 'pending_approval',
      company_name: 'Acme',
      cover_image_url: 'https://x/cover.jpg',
      onboarding_completed_at: null,
    }

    it('is incomplete after step 1 even though status is not draft', () => {
      expect(isOnboardingComplete('brand', midWizard)).toBe(false)
    })

    it('is complete once the final step records a timestamp', () => {
      expect(
        isOnboardingComplete('brand', {
          ...midWizard,
          onboarding_completed_at: '2026-07-30T10:00:00.000Z',
        }),
      ).toBe(true)
    })

    // Awaiting admin approval is not the same as unfinished onboarding: a brand
    // in that state must be able to reach /brand/subscription.
    it('does not depend on admin approval having happened', () => {
      expect(
        isOnboardingComplete('brand', {
          status: 'pending_approval',
          onboarding_completed_at: '2026-07-30T10:00:00.000Z',
        }),
      ).toBe(true)
    })
  })

  it('projects the columns each role check actually reads', () => {
    expect(ONBOARDING_PROGRESS_COLUMNS.brand).toContain('onboarding_completed_at')
    for (const role of NAV_ROLES) {
      expect(ONBOARDING_PROGRESS_COLUMNS[role]).toContain('status')
    }
  })
})
