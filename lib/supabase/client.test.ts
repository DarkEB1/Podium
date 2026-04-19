import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createBrowserClient } from '@supabase/ssr'

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({ auth: {}, from: vi.fn() })),
}))

describe('createClient', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('returns a Supabase client', async () => {
    const { createClient } = await import('./client')
    const client = createClient()
    expect(client).toBeDefined()
    expect(client).toHaveProperty('auth')
  })

  it('calls createBrowserClient with env vars', async () => {
    const { createClient } = await import('./client')
    createClient()
    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key'
    )
  })
})
