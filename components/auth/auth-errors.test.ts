import { describe, it, expect } from 'vitest'
import { AUTH_ERROR_CODES, authErrorMessage, classifyAuthError } from './auth-errors'

describe('authErrorMessage', () => {
  it('returns nothing when there is no error', () => {
    expect(authErrorMessage(null)).toBeNull()
    expect(authErrorMessage(undefined)).toBeNull()
    expect(authErrorMessage('')).toBeNull()
  })

  it('renders human copy for every known code, never the raw code', () => {
    for (const code of Object.values(AUTH_ERROR_CODES)) {
      const message = authErrorMessage(code)
      expect(message).toBeTruthy()
      expect(message).not.toContain(code)
      expect(message).not.toMatch(/_/)
    }
  })

  it('falls back to generic copy for an unknown code', () => {
    const message = authErrorMessage('something_someone_appended')
    expect(message).toBe(authErrorMessage(AUTH_ERROR_CODES.failed))
  })
})

describe('classifyAuthError', () => {
  it('detects an expired link', () => {
    expect(classifyAuthError('otp_expired', 'Email link is invalid or has expired')).toBe(
      AUTH_ERROR_CODES.expiredLink,
    )
  })

  it('detects an already-used link', () => {
    expect(classifyAuthError(null, 'Code has already been redeemed')).toBe(
      AUTH_ERROR_CODES.alreadyUsed,
    )
  })

  it('detects an invalid link', () => {
    expect(classifyAuthError(null, 'invalid code')).toBe(AUTH_ERROR_CODES.invalidLink)
  })

  it('falls back to the generic failure', () => {
    expect(classifyAuthError('server_error', 'boom')).toBe(AUTH_ERROR_CODES.failed)
  })
})
