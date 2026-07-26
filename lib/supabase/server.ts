import { cache } from 'react'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * FA-3 / NX-6 — one Supabase client per request.
 *
 * Wrapped in React's `cache()` so every Server Component in a single render
 * pass gets the *same* instance. That is what makes the `cache()` in
 * `lib/supabase/auth.ts` effective: its memo is keyed on the client argument,
 * so without a shared instance a layout and its page would each pay the two
 * round-trips of `getUser()`.
 *
 * The memo lives in React's per-request store, so it is created fresh for each
 * request and discarded with it — a client built from request A's cookies can
 * never be handed to request B. Outside a request scope (tests, scripts) React
 * does not memoise and this behaves exactly like an un-wrapped function.
 */
export const createClient = cache(async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // setAll called from Server Component — safe to ignore
        }
      },
    },
  })
})

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false },
  })
}
