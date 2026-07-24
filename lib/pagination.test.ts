import { describe, it, expect } from 'vitest'
import { parseShowParam } from './pagination'

describe('parseShowParam', () => {
  it('defaults to one page when the parameter is absent', () => {
    expect(parseShowParam(undefined, 24)).toBe(24)
  })

  it('accepts a page-boundary value', () => {
    expect(parseShowParam('48', 24)).toBe(48)
  })

  it('rounds up to the next page boundary', () => {
    expect(parseShowParam('50', 24)).toBe(72)
  })

  it('ignores junk, negatives and sub-page values', () => {
    expect(parseShowParam('abc', 24)).toBe(24)
    expect(parseShowParam('-5', 24)).toBe(24)
    expect(parseShowParam('0', 24)).toBe(24)
    expect(parseShowParam('', 24)).toBe(24)
  })

  it('caps at the ceiling so a crafted URL cannot ask for the whole table', () => {
    expect(parseShowParam('100000', 24)).toBe(240)
    expect(parseShowParam('100000', 24, 48)).toBe(48)
  })

  it('takes the first value of a repeated query parameter', () => {
    expect(parseShowParam(['48', '9999'], 24)).toBe(48)
  })
})
