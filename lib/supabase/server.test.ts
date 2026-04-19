import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([{ name: 'sb-token', value: 'abc' }]),
    set: vi.fn(),
  }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: {}, from: vi.fn() })),
}))

describe('createClient (server)', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('returns a Supabase server client', async () => {
    const { createClient } = await import('./server')
    const client = await createClient()
    expect(client).toBeDefined()
    expect(client).toHaveProperty('auth')
  })

  it('is async (returns a Promise)', async () => {
    const { createClient } = await import('./server')
    const result = createClient()
    expect(result).toBeInstanceOf(Promise)
  })
})
