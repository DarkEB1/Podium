import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiFetch, isAuthFailure, ApiAuthError } from './fetch-json'

function fakeResponse(init: { status?: number; redirected?: boolean; body?: unknown }): Response {
  // A minimal stand-in: Response has no public constructor flag for `redirected`,
  // so build a plain object with the fields apiFetch reads.
  const res = {
    status: init.status ?? 200,
    ok: (init.status ?? 200) < 400,
    redirected: init.redirected ?? false,
    json: async () => init.body,
  }
  return res as unknown as Response
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isAuthFailure', () => {
  it('treats a followed redirect as an auth failure', () => {
    expect(isAuthFailure(fakeResponse({ status: 200, redirected: true }))).toBe(true)
  })

  it('treats a 401 as an auth failure', () => {
    expect(isAuthFailure(fakeResponse({ status: 401 }))).toBe(true)
  })

  it('treats a normal 200 and a normal 400 as not-auth-failures', () => {
    expect(isAuthFailure(fakeResponse({ status: 200 }))).toBe(false)
    expect(isAuthFailure(fakeResponse({ status: 400 }))).toBe(false)
  })
})

describe('apiFetch', () => {
  it('throws ApiAuthError when the request was redirected to sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ status: 200, redirected: true })))
    await expect(apiFetch('/api/deals/contracts/c1/sign', { method: 'POST' })).rejects.toBeInstanceOf(
      ApiAuthError,
    )
  })

  it('throws ApiAuthError on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ status: 401 })))
    await expect(apiFetch('/api/x')).rejects.toBeInstanceOf(ApiAuthError)
  })

  it('returns the response for a normal success', async () => {
    const ok = fakeResponse({ status: 200, body: { ok: true } })
    vi.stubGlobal('fetch', vi.fn(async () => ok))
    const res = await apiFetch('/api/x')
    expect(res).toBe(ok)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns the response for an application error (e.g. 400) so the caller can read it', async () => {
    const bad = fakeResponse({ status: 400, body: { error: { code: 'NOPE' } } })
    vi.stubGlobal('fetch', vi.fn(async () => bad))
    const res = await apiFetch('/api/x')
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('NOPE')
  })
})
