import { describe, it, expect } from 'vitest'
import {
  NAV_ROLES,
  navItemsForRole,
  ctaForRole,
  bottomNavForRole,
  buildBreadcrumbs,
  humaniseSegment,
  isActiveHref,
} from './config'

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

  it('gives every role a persistent CTA with a role-scoped href', () => {
    for (const role of NAV_ROLES) {
      const cta = ctaForRole(role)
      expect(cta.label).toBeTruthy()
      expect(cta.href.startsWith(`/${role}/`)).toBe(true)
    }
  })

  it("uses the brand CTA 'Post a Listing'", () => {
    expect(ctaForRole('brand').label).toMatch(/post a listing/i)
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
