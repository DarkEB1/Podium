import { describe, expect, it } from 'vitest'

import { UK_UNIVERSITIES } from './universities'

describe('UK_UNIVERSITIES', () => {
  it('covers the recognised UK HE institutions (roughly 160 bodies)', () => {
    expect(UK_UNIVERSITIES.length).toBeGreaterThanOrEqual(150)
  })

  it('has unique slug ids in URL-safe form', () => {
    const ids = UK_UNIVERSITIES.map((u) => u.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('every entry has a name and a city', () => {
    for (const u of UK_UNIVERSITIES) {
      expect(u.name.trim().length).toBeGreaterThan(0)
      expect(u.city.trim().length).toBeGreaterThan(0)
    }
  })

  it('includes collegiate institutions at parent level only', () => {
    const names = UK_UNIVERSITIES.map((u) => u.name)
    expect(names).toContain('University of Oxford')
    expect(names).toContain('University of Cambridge')
    // No individual Oxbridge colleges.
    expect(names.some((n) => /college, (oxford|cambridge)/i.test(n))).toBe(false)
  })

  it('spans all four nations', () => {
    const ids = new Set(UK_UNIVERSITIES.map((u) => u.id))
    expect(ids.has('loughborough-university')).toBe(true) // England
    expect(ids.has('cardiff-university')).toBe(true) // Wales
    expect(ids.has('university-of-edinburgh')).toBe(true) // Scotland
    expect(ids.has('queens-university-belfast')).toBe(true) // Northern Ireland
  })
})
