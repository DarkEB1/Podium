import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendViaProvider } from './provider'

// ---------------------------------------------------------------------------
// Each test stubs global.fetch and the RESEND_API_KEY env, restoring after.
// ---------------------------------------------------------------------------

function okResponse(json: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => json,
    text: async () => JSON.stringify(json),
  } as unknown as Response
}

function errResponse(status: number, body = 'error detail'): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  } as unknown as Response
}

const baseParams = {
  to: 'user@test.example',
  subject: 'Hello',
  html: '<p>hi</p>',
  text: 'hi',
}

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sendViaProvider — no provider configured', () => {
  it('reports skipped and does NOT call fetch when RESEND_API_KEY is unset', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendViaProvider(baseParams)

    expect(result).toMatchObject({ ok: false, skipped: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('sendViaProvider — success', () => {
  it('returns ok + providerId extracted from the JSON id on a 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ id: 'resend-123' })))

    const result = await sendViaProvider(baseParams)

    expect(result).toEqual({ ok: true, providerId: 'resend-123' })
  })

  it('falls back to "unknown" providerId when the JSON has no id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({})))

    const result = await sendViaProvider(baseParams)

    expect(result).toEqual({ ok: true, providerId: 'unknown' })
  })
})

describe('sendViaProvider — failures and retriability', () => {
  it('treats a 4xx as non-retriable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errResponse(422)))

    const result = await sendViaProvider(baseParams)

    expect(result).toMatchObject({ ok: false, retriable: false })
  })

  it('treats a 429 as retriable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errResponse(429)))

    const result = await sendViaProvider(baseParams)

    expect(result).toMatchObject({ ok: false, retriable: true })
  })

  it('treats a 5xx as retriable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errResponse(503)))

    const result = await sendViaProvider(baseParams)

    expect(result).toMatchObject({ ok: false, retriable: true })
  })

  it('treats a thrown fetch (network error) as retriable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))

    const result = await sendViaProvider(baseParams)

    expect(result).toMatchObject({ ok: false, retriable: true })
  })
})

describe('sendViaProvider — RFC 8058 one-click unsubscribe headers', () => {
  it('adds List-Unsubscribe and List-Unsubscribe-Post to the request body headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: 'x' }))
    vi.stubGlobal('fetch', fetchMock)

    await sendViaProvider({
      ...baseParams,
      listUnsubscribeUrl: 'https://app.podium.test/api/unsubscribe?token=abc',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { headers?: Record<string, string> }
    expect(body.headers?.['List-Unsubscribe']).toBe(
      '<https://app.podium.test/api/unsubscribe?token=abc>'
    )
    expect(body.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('omits the unsubscribe headers when no listUnsubscribeUrl is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: 'x' }))
    vi.stubGlobal('fetch', fetchMock)

    await sendViaProvider(baseParams)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { headers?: Record<string, string> }
    expect(body.headers).toBeUndefined()
  })
})
