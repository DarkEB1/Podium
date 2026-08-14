import { describe, it, expect } from 'vitest'

import { athleteLevelLabel, ATHLETE_LEVEL_LABELS } from './levels'

describe('athleteLevelLabel', () => {
  // The regression: the public profile page humanised the enum value and
  // rendered "Semi professional", while settings showed "Semi-Professional".
  it('keeps the canonical hyphenated spelling for semi_professional', () => {
    expect(athleteLevelLabel('semi_professional')).toBe('Semi-Professional')
  })

  it('labels every known enum value', () => {
    for (const [value, label] of Object.entries(ATHLETE_LEVEL_LABELS)) {
      expect(athleteLevelLabel(value)).toBe(label)
    }
  })

  it('humanises unknown values rather than rendering them raw', () => {
    expect(athleteLevelLabel('national_academy')).toBe('National academy')
  })

  it('returns null for missing values', () => {
    expect(athleteLevelLabel(null)).toBeNull()
    expect(athleteLevelLabel(undefined)).toBeNull()
    expect(athleteLevelLabel('')).toBeNull()
  })
})
