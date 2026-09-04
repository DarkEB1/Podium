import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
const createSignedDownloadUrl = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({})),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: (...a: unknown[]) => getUser(...a) }))

// Keep the real StorageError class so `instanceof` works in the route.
vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage')
  return {
    ...actual,
    createSignedDownloadUrl: (...a: unknown[]) => createSignedDownloadUrl(...a),
  }
})

import { GET } from './route'
import { StorageError } from '@/lib/storage'

function req(path?: string) {
  const url = new URL('https://podium.test/api/team/docs')
  if (path !== undefined) url.searchParams.set('path', path)
  return new NextRequest(url, { method: 'GET' })
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ id: 'u1', role: 'team', email: 't@x.com' })
  createSignedDownloadUrl.mockReset().mockResolvedValue('https://storage/signed?token=abc')
})

describe('GET /api/team/docs', () => {
  it('401 when not signed in', async () => {
    getUser.mockResolvedValue(null)
    expect((await GET(req('u1/brief.pdf'))).status).toBe(401)
    expect(createSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('400 when no path is supplied', async () => {
    const res = await GET(req())
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_PATH')
  })

  it('returns a signed URL for the docs object', async () => {
    const res = await GET(req('u1/brief.pdf'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://storage/signed?token=abc' })
    expect(createSignedDownloadUrl).toHaveBeenCalledWith(expect.anything(), 'docs', 'u1/brief.pdf')
  })

  it('403 when the object is not readable by the caller (RLS denies the sign)', async () => {
    createSignedDownloadUrl.mockRejectedValue(new StorageError('signed_url_failed', 'denied'))
    const res = await GET(req('other/secret.pdf'))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('DOC_NOT_ACCESSIBLE')
  })
})
