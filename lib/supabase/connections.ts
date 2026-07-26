import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'

/**
 * Connection-request read accessors (B-1 follow-up / SB-10 / FA-1 / FA-8).
 *
 * `lib/supabase/discovery.ts` owns the WRITE side of `connection_requests`
 * (send / respond / withdraw). It has no read accessor, so
 * `app/(athlete)/athlete/requests/page.tsx` queried the table inline with
 * `select('*')` — a direct Supabase call outside `lib/supabase/`, which
 * CLAUDE.md forbids, and the reason no other role could get an inbox without
 * copy-pasting the same query again.
 *
 * The core loop depends on this read: a connection request that cannot be
 * listed cannot be accepted, and the match-creation trigger only fires on
 * acceptance — so with no inbox, messaging, proposals, contracts and payments
 * are all unreachable.
 */

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

export type { ConnectionRequestRow }

/**
 * Explicit column projection. `select('*')` ships whatever the table happens to
 * gain next (SB-10); listing the columns keeps the payload and the type in
 * lockstep and makes an accidental new PII column a compile step rather than a
 * silent leak. This is every column of the row type — the card renders sender,
 * message and timestamps and the list keys on id.
 */
export const CONNECTION_REQUEST_COLUMNS =
  'id, sender_id, recipient_id, message, status, sent_at, responded_at, created_at, updated_at'

export class ConnectionsError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ConnectionsError'
  }
}

export interface IncomingRequestOptions {
  /**
   * Which statuses to return. Defaults to pending only — the inbox is a queue
   * of decisions, not a history.
   */
  status?: ConnectionRequestRow['status'] | undefined
  /** Upper bound on rows returned. */
  limit?: number | undefined
}

/**
 * Every connection request WHERE THE GIVEN USER IS THE RECIPIENT — i.e. the
 * accept/decline inbox for `userId`, whatever role that user has.
 *
 * Role-agnostic by design: `connection_requests.recipient_id` is a FK to
 * `users.id`, not to any role profile table, so the same accessor serves the
 * athlete, brand, team and agent inboxes. Adding an inbox for a new role is a
 * page, never another query.
 */
export async function getIncomingConnectionRequests(
  supabase: SupabaseClient<Database>,
  userId: string,
  options: IncomingRequestOptions = {}
): Promise<ConnectionRequestRow[]> {
  const { status = 'pending', limit = 100 } = options

  // chain type inference that makes this file's build time explode — the same
  // pattern used throughout lib/supabase/discovery.ts.
  const { data, error } = await db(supabase)
    .from('connection_requests')
    .select(CONNECTION_REQUEST_COLUMNS)
    .eq('recipient_id', userId)
    .eq('status', status)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new ConnectionsError(
      'INCOMING_REQUESTS_FETCH_FAILED',
      (error as { message: string }).message
    )
  }

  // as ConnectionRequestRow[]: the projection above selects exactly the columns
  // of the row type, which the untyped client cannot prove.
  return (data ?? []) as unknown as ConnectionRequestRow[]
}

/**
 * Requests the given user SENT that are still awaiting a decision. Used to show
 * a sender their outstanding outreach (and to withdraw it).
 */
export async function getOutgoingConnectionRequests(
  supabase: SupabaseClient<Database>,
  userId: string,
  options: IncomingRequestOptions = {}
): Promise<ConnectionRequestRow[]> {
  const { status = 'pending', limit = 100 } = options

  const { data, error } = await db(supabase)
    .from('connection_requests')
    .select(CONNECTION_REQUEST_COLUMNS)
    .eq('sender_id', userId)
    .eq('status', status)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new ConnectionsError(
      'OUTGOING_REQUESTS_FETCH_FAILED',
      (error as { message: string }).message
    )
  }

  // as ConnectionRequestRow[]: see getIncomingConnectionRequests.
  return (data ?? []) as unknown as ConnectionRequestRow[]
}

/** How many decisions are waiting on this user — for a nav badge or dashboard stat. */
export async function countIncomingConnectionRequests(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const { count, error } = await db(supabase)
    .from('connection_requests')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('status', 'pending')

  if (error) {
    throw new ConnectionsError(
      'INCOMING_REQUESTS_COUNT_FAILED',
      (error as { message: string }).message
    )
  }

  return count ?? 0
}

/**
 * Display names for a set of sender user ids, keyed by user id.
 *
 * The request card used to print the raw `sender_id` UUID under a hardcoded
 * "Connection request from brand" label. Both were wrong: a UUID is not a name,
 * and in the only inbox that actually receives requests today the sender is an
 * athlete or team, never a brand.
 *
 * There is no single `profiles` table, so this probes the four role tables —
 * but with `.in(...)`, so it is four queries regardless of how many requests
 * are on screen, not four per request (SB-3's N+1 lesson).
 */
export async function getSenderDisplayNames(
  supabase: SupabaseClient<Database>,
  userIds: readonly string[]
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return {}

  const client = db(supabase)
  const names: Record<string, string> = {}

  // Ordered least-to-most specific so a user holding two profiles resolves
  // deterministically to the same label the inbox uses.
  const [athletes, teams, brands, agents] = await Promise.all([
    client.from('athlete_profiles').select('user_id, display_name').in('user_id', ids),
    client.from('team_profiles').select('user_id, team_name').in('user_id', ids),
    client.from('brand_profiles').select('user_id, company_name, trading_name').in('user_id', ids),
    client.from('agent_profiles').select('user_id, agency_name, agent_full_name').in('user_id', ids),
  ])

  for (const row of (agents.data ?? []) as {
    user_id: string
    agency_name: string | null
    agent_full_name: string | null
  }[]) {
    const name = row.agency_name ?? row.agent_full_name
    if (name) names[row.user_id] = name
  }
  for (const row of (brands.data ?? []) as {
    user_id: string
    company_name: string
    trading_name: string | null
  }[]) {
    names[row.user_id] = row.trading_name ?? row.company_name
  }
  for (const row of (teams.data ?? []) as { user_id: string; team_name: string | null }[]) {
    if (row.team_name) names[row.user_id] = row.team_name
  }
  for (const row of (athletes.data ?? []) as {
    user_id: string
    display_name: string | null
  }[]) {
    if (row.display_name) names[row.user_id] = row.display_name
  }

  return names
}
