import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const mockAcceptTerms = vi.fn()
vi.mock('@/lib/supabase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/auth')>()),
  acceptTerms: (...args: unknown[]) => mockAcceptTerms(...args),
}))

import { createClient } from '@/lib/supabase/server'
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions'
import { POST } from './route'

/** CL-5: a valid signup must now carry the policy versions the user was shown. */
const CONSENT = { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new URL('/api/auth/signup', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup', () => {
  const mockSignUp = vi.fn()

  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    // Call history must not leak between tests — the consent gate asserts that
    // signUp was NOT reached.
    mockSignUp.mockClear()
    mockAcceptTerms.mockClear()
    mockSignUp.mockResolvedValue({ data: { user: null }, error: null })
  })

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ password: 'ValidPass1!' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 for an email over the RFC 5321 254-char cap', async () => {
    const res = await POST(
      makeRequest({ email: `${'a'.repeat(250)}@example.com`, password: 'ValidPass1!', ...CONSENT })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_EMAIL')
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('returns 400 for a password over 128 chars', async () => {
    const res = await POST(
      makeRequest({ email: 'test@example.com', password: `Aa1!${'x'.repeat(130)}`, ...CONSENT })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('WEAK_PASSWORD')
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('returns 400 when password is too weak', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com', password: 'weak' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('WEAK_PASSWORD')
  })

  it('returns 200 with success message on valid signup (enumeration protection)', async () => {
    const res = await POST(makeRequest({ email: 'new@example.com', password: 'ValidPass1!', ...CONSENT }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toMatch(/email/i)
  })

  it('still returns 200 when Supabase reports email already registered (enumeration protection)', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } })
    const res = await POST(makeRequest({ email: 'existing@example.com', password: 'ValidPass1!', ...CONSENT }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toMatch(/email/i)
  })

  it('rejects a signup that does not accept the current policies (CL-5)', async () => {
    const res = await POST(makeRequest({ email: 'new@example.com', password: 'ValidPass1!' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('POLICY_NOT_ACCEPTED')
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('rejects a signup carrying a superseded policy version (CL-5)', async () => {
    const res = await POST(
      makeRequest({
        email: 'new@example.com',
        password: 'ValidPass1!',
        termsVersion: '1970-01-01',
        privacyVersion: PRIVACY_VERSION,
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('POLICY_NOT_ACCEPTED')
  })

  it('records policy acceptance against the new account (CL-5)', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const res = await POST(
      makeRequest({ email: 'new@example.com', password: 'ValidPass1!', ...CONSENT })
    )
    expect(res.status).toBe(200)
    expect(mockAcceptTerms).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      TERMS_VERSION,
      PRIVACY_VERSION
    )
  })
})
