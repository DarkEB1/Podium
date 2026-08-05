import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSend = vi.fn()
vi.mock('@/lib/email/provider', () => ({
  sendViaProvider: (...args: unknown[]) => mockSend(...args),
}))

const mockConsumeAll = vi.fn()
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  consumeAll: (...args: unknown[]) => mockConsumeAll(...args),
}))

import { POST } from './route'
import { CONTROLLER } from '@/lib/legal/versions'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new URL('/api/contact', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID = {
  name: 'Jamie Athlete',
  email: 'jamie@example.com',
  message: 'I have a question about listing my team on Podium.',
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    mockSend.mockReset()
    mockConsumeAll.mockReset()
    mockConsumeAll.mockResolvedValue({ allowed: true, attempts: 1, retryAfter: 0, degraded: false })
    mockSend.mockResolvedValue({ ok: true, providerId: 'em_1' })
  })

  it('relays a valid submission to the support inbox with the sender as Reply-To', async () => {
    const res = await POST(makeRequest(VALID))
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: CONTROLLER.supportEmail,
        replyTo: VALID.email,
        text: expect.stringContaining(VALID.message),
      })
    )
  })

  it('rejects a missing message', async () => {
    const res = await POST(makeRequest({ ...VALID, message: '' }))
    expect(res.status).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects an invalid email shape', async () => {
    const res = await POST(makeRequest({ ...VALID, email: 'not-an-email' }))
    expect(res.status).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  // The reviewer's exact worry: an uncapped free-text relay "gets rinsed".
  it('rejects an overlong message before it reaches the provider', async () => {
    const res = await POST(makeRequest({ ...VALID, message: 'x'.repeat(2001) }))
    expect(res.status).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects an overlong name', async () => {
    const res = await POST(makeRequest({ ...VALID, name: 'x'.repeat(101) }))
    expect(res.status).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns 429 when the IP rate limit trips', async () => {
    mockConsumeAll.mockResolvedValue({ allowed: false, attempts: 6, retryAfter: 120, degraded: false })
    const res = await POST(makeRequest(VALID))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('120')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('a filled honeypot returns the success shape without sending anything', async () => {
    const res = await POST(makeRequest({ ...VALID, website: 'https://spam.example' }))
    expect(res.status).toBe(200)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('escapes HTML in the message body', async () => {
    await POST(makeRequest({ ...VALID, message: '<script>alert(1)</script> hello there' }))
    const params = mockSend.mock.calls[0]![0] as { html: string }
    expect(params.html).not.toContain('<script>')
    expect(params.html).toContain('&lt;script&gt;')
  })

  it('returns 503 with a fallback address when the provider fails', async () => {
    mockSend.mockResolvedValue({ ok: false, retriable: true, error: 'provider 500' })
    const res = await POST(makeRequest(VALID))
    expect(res.status).toBe(503)
    const json = (await res.json()) as { error: { message: string } }
    expect(json.error.message).toContain(CONTROLLER.supportEmail)
  })
})
