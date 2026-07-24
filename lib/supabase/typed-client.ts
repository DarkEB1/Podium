import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/**
 * FA-6 — the one place in the codebase that strips the `Database` generic off a
 * Supabase client.
 *
 * ## Why this cast exists
 *
 * `SupabaseClient<Database>` makes PostgREST's builder chain fully generic: for
 * every `.from().select().eq()...` the compiler resolves the row shape, the
 * relationship graph and the returned column subset by parsing the select
 * string at the type level. On a schema this size that inference is quadratic
 * in practice — `tsc` blows past its instantiation limit ("Type instantiation
 * is excessively deep and possibly infinite") on the wide queries in
 * discovery/messaging, and even where it succeeds it dominates build time.
 *
 * Dropping the generic degrades the *builder's* inference to `any`, so each
 * query function annotates its own return type from `types/database.ts`
 * instead. The row types are therefore still checked at the function boundary —
 * only the intermediate chain is untyped.
 *
 * ## Why it is a function and not 161 inline casts
 *
 * Before this helper there were 161 `as SupabaseClient` casts in non-test
 * source, each with its own copy of the paragraph above (usually abbreviated to
 * "see the other one"). Centralising it means the justification is written once
 * and a future reviewer has a single place to check when the upstream
 * inference cost is fixed and the cast can be deleted.
 *
 * Behaviourally this is the identity function.
 *
 * @example
 *   const { data, error } = await db(supabase).from('users').select('id')
 */
export function db(client: SupabaseClient<Database>): SupabaseClient {
  // as SupabaseClient: intentional widening — see the doc comment above. This
  // is the ONLY place in the codebase allowed to perform it.
  return client as SupabaseClient
}
