import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { isUuid, safeErrorResponse, readJsonBody } from './errors'

class FakeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'FakeError'
  }
}

describe('isUuid', () => {
  it('accepts a canonical v4 UUID', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true)
  })
  it('rejects non-UUID strings and non-strings', () => {
    expect(isUuid('user-2')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid(42)).toBe(false)
    expect(isUuid(null)).toBe(false)
  })
})

describe('safeErrorResponse', () => {
  it('returns null for a non-coded error so the caller re-throws', () => {
    expect(safeErrorResponse(new Error('boom'), { scope: 't' })).toBeNull()
    expect(safeErrorResponse('nope', { scope: 't' })).toBeNull()
  })

  it('shows the message for a safe code and maps its status', async () => {
    const res = safeErrorResponse(new FakeError('NOT_FOUND', 'Report not found'), {
      scope: 't',
      statusByCode: { NOT_FOUND: 404 },
      safeToShow: ['NOT_FOUND'],
    })
    expect(res).not.toBeNull()
    expect(res!.status).toBe(404)
    expect((await res!.json()).error.message).toBe('Report not found')
  })

  it('hides raw driver text for an unmapped code and defaults to 500', async () => {
    const raw = 'null value in column "status" violates not-null constraint'
    const res = safeErrorResponse(new FakeError('DB_FAILED', raw), { scope: 't' })
    expect(res!.status).toBe(500)
    const body = await res!.json()
    expect(body.error.code).toBe('DB_FAILED')
    expect(body.error.message).not.toBe(raw)
    expect(JSON.stringify(body)).not.toContain('not-null')
  })
})

describe('readJsonBody', () => {
  it('returns a 400 response for malformed JSON', async () => {
    const req = new NextRequest(new URL('http://localhost/x'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ bad',
    })
    const out = await readJsonBody(req)
    expect('response' in out).toBe(true)
    if ('response' in out) expect(out.response.status).toBe(400)
  })

  it('parses a valid JSON body', async () => {
    const req = new NextRequest(new URL('http://localhost/x'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    })
    const out = await readJsonBody(req)
    expect('body' in out).toBe(true)
    if ('body' in out) expect(out.body).toEqual({ a: 1 })
  })
})
