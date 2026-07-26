import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { ROUTES, ROLE_DASHBOARD, ROLE_ONBOARDING, staticRoutes } from './routes'

const APP_DIR = path.resolve(__dirname, '..', 'app')

/**
 * Walk `app/` and derive the set of real, statically-addressable routes:
 * a directory containing `page.tsx` (a page) or `route.ts` (an API handler),
 * with route-group segments — `(public)`, `(athlete)` … — stripped out.
 * Dynamic routes (`[userId]`) are excluded; ROUTES models those as functions.
 */
function collectRoutes(dir: string, segments: string[] = []): string[] {
  const found: string[] = []
  const entries = readdirSync(dir)

  const hasPage = entries.includes('page.tsx') || entries.includes('route.ts')
  if (hasPage && !segments.some((s) => s.startsWith('['))) {
    found.push('/' + segments.join('/'))
  }

  for (const entry of entries) {
    const full = path.join(dir, entry)
    if (!statSync(full).isDirectory()) continue
    // Route groups and private folders do not contribute a URL segment.
    if (/^\(.*\)$/.test(entry)) {
      found.push(...collectRoutes(full, segments))
    } else if (entry.startsWith('_')) {
      continue
    } else {
      found.push(...collectRoutes(full, [...segments, entry]))
    }
  }

  return found
}

const realRoutes = new Set(collectRoutes(APP_DIR).map((r) => (r === '/' ? '/' : r.replace(/\/$/, ''))))

describe('ROUTES', () => {
  it('derives a non-trivial route inventory from app/', () => {
    // Sanity: if the walker breaks, the assertions below would vacuously pass.
    expect(realRoutes.size).toBeGreaterThan(20)
    expect(realRoutes.has('/')).toBe(true)
  })

  it.each(staticRoutes().sort())('%s resolves to a real page or route handler', (route) => {
    expect(realRoutes.has(route)).toBe(true)
  })

  it('maps every role to a real dashboard', () => {
    for (const href of Object.values(ROLE_DASHBOARD)) {
      expect(realRoutes.has(href)).toBe(true)
    }
  })

  it('maps every role to a real onboarding entry point', () => {
    for (const href of Object.values(ROLE_ONBOARDING)) {
      expect(realRoutes.has(href)).toBe(true)
    }
  })

  it('does not point sign-in at the non-existent /login', () => {
    expect(ROUTES.auth.signIn).toBe('/auth')
    expect(realRoutes.has('/login')).toBe(false)
  })

  it('builds dynamic paths from their segment values', () => {
    expect(ROUTES.athlete.profileFor('abc')).toBe('/athlete/profile/abc')
    expect(ROUTES.athlete.onboardingStep(3)).toBe('/athlete/onboarding/step/3')
    expect(ROUTES.auth.signUpAs('brand')).toBe('/auth/signup?role=brand')
  })

  it('excludes in-page anchors from the static route list', () => {
    expect(staticRoutes()).not.toContain(ROUTES.landing.howItWorks)
  })
})
