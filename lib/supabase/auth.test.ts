import { describe, it, expect } from 'vitest'
import { validatePassword } from './auth'

describe('validatePassword', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const result = validatePassword('Ab1!')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/8/)
  })

  it('rejects passwords without an uppercase letter', () => {
    const result = validatePassword('abcdef1!')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/uppercase/i)
  })

  it('rejects passwords without a number', () => {
    const result = validatePassword('Abcdefg!')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/number/i)
  })

  it('rejects passwords without a symbol', () => {
    const result = validatePassword('Abcdef12')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/symbol/i)
  })

  it('accepts a password meeting all requirements', () => {
    expect(validatePassword('ValidPass1!')).toEqual({ valid: true })
  })

  it('accepts passwords with various symbol characters', () => {
    expect(validatePassword('ValidPass1@').valid).toBe(true)
    expect(validatePassword('ValidPass1#').valid).toBe(true)
    expect(validatePassword('ValidPass1$').valid).toBe(true)
  })
})
