import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { CONNECTION_MESSAGE_BOUNDS, checkLength } from '@/lib/limits'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

/**
 * A listing plus the owning brand's **auth user id** (PR-19).
 *
 * `job_listings.brand_id` is a FK to `brand_profiles.id`, but every
 * outreach target (`connection_requests.recipient_id`, `matches.user_a_id`,
 * messaging) is a FK to `users.id`. Surfaces that let an athlete contact a
 * listing owner were posting `brand_id` as the recipient, which violated the
 * recipient FK on every single send — one of the root causes of "sending a
 * connection request does not work". Callers that need to contact the brand
 * must use `brand_user_id`, never `brand_id`.
 */
export interface JobListingWithBrand extends JobListingRow {
  brand_user_id: string | null
  brand_name: string | null
  brand_logo_url: string | null
  brand_cover_url: string | null
  brand_description: string | null
}
type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']
type ShortlistRow = Database['public']['Tables']['shortlists']['Row']
type BlockRow = Database['public']['Tables']['blocks']['Row']

// Fields that must never be set by callers — status is controlled via publishListing,
// brand_id is always set from the authenticated brand profile, not user input.
const LISTING_PROTECTED_FIELDS = new Set([
  'id',
  'brand_id',
  'status',
  'created_at',
  'updated_at',
])

/**
 * Drops protected keys and empty strings, exactly as sanitizeProfileData does.
 *
 * Every optional field on the listing form submits '' when left blank, and
 * `application_deadline` is a **timestamptz**: Postgres rejects '' with 22007
 * and fails the entire insert, so a brand could not create a listing at all
 * unless it set a deadline. `null` still passes through — it is how a deadline
 * is cleared.
 */
function sanitizeListingData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => {
      if (LISTING_PROTECTED_FIELDS.has(key)) return false
      if (value === '') return false
      return true
    })
  )
}

// ---------------------------------------------------------------------------
// Application deadlines (L-6 / DI-3)
// ---------------------------------------------------------------------------

/**
 * `job_listings.application_deadline` is **timestamptz** (see
 * 20260419000003_discovery.sql), but the only writer — the listing form's
 * `<Input type="date">` — submits a bare `YYYY-MM-DD`, which Postgres stores as
 * midnight UTC at the *start* of that day.
 *
 * Comparing that instant against `now()` would therefore drop a listing out of
 * the feed at 00:00 on its own deadline day: a brand that types "20 July" would
 * see the listing vanish for the whole of 20 July. The deadline is treated as
 * **inclusive of its own day** instead — the cutoff is the start of the current
 * UTC day, so a listing stays discoverable through the end of its deadline day
 * and disappears at 00:00 UTC the following day.
 *
 * UTC is used deliberately: the stored value is an unqualified date normalised
 * to UTC, so anchoring the cutoff to the server's local day would make the same
 * listing expire at different times on different deployments.
 */
export function listingDeadlineCutoff(now: Date = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString()
}

/**
 * PostgREST `or=` predicate for "the deadline has not passed".
 *
 * A null deadline means the listing never expires. The comparison runs in
 * Postgres — filtering in JavaScript would still ship every expired row over
 * the wire and would silently break `hasMore` paging.
 */
export function listingDeadlinePredicate(cutoffIso: string): string {
  return `application_deadline.is.null,application_deadline.gte.${cutoffIso}`
}

/** True when a listing is still accepting applications right now. */
export function isListingOpenForApplications(
  listing: Pick<JobListingRow, 'status' | 'application_deadline'>,
  now: Date = new Date()
): boolean {
  if (listing.status !== 'active') return false
  if (!listing.application_deadline) return true

  // Compared as instants, never as strings: Postgres returns
  // `2026-07-20T00:00:00+00:00` where the cutoff is `2026-07-20T00:00:00.000Z`.
  // Those are the same moment but sort differently as text, so a lexicographic
  // comparison would reject a listing on its own deadline day.
  const deadline = Date.parse(listing.application_deadline)
  if (Number.isNaN(deadline)) return true

  return deadline >= Date.parse(listingDeadlineCutoff(now))
}

export class DiscoveryError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'DiscoveryError'
  }
}

// ---------------------------------------------------------------------------
// Job Listings
// ---------------------------------------------------------------------------

export async function createListing(
  supabase: SupabaseClient<Database>,
  brandProfileId: string,
  data: Record<string, unknown>
): Promise<JobListingRow> {
  const safe = sanitizeListingData(data)
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: listing, error } = await (supabase as SupabaseClient)
    .from('job_listings')
    .insert({ ...safe, brand_id: brandProfileId })
    .select()
    .single()

  if (error) {
    throw new DiscoveryError('LISTING_CREATE_FAILED', (error as { message: string }).message)
  }

  return listing as JobListingRow
}

export async function updateListing(
  supabase: SupabaseClient<Database>,
  listingId: string,
  brandProfileId: string,
  data: Record<string, unknown>
): Promise<JobListingRow> {
  const safe = sanitizeListingData(data)
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: listing, error } = await (supabase as SupabaseClient)
    .from('job_listings')
    .update(safe)
    .eq('id', listingId)
    .eq('brand_id', brandProfileId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new DiscoveryError('LISTING_NOT_FOUND', 'Listing not found or not owned by this brand')
    }
    throw new DiscoveryError('LISTING_UPDATE_FAILED', (error as { message: string }).message)
  }

  return listing as JobListingRow
}

export async function publishListing(
  supabase: SupabaseClient<Database>,
  listingId: string,
  brandProfileId: string
): Promise<void> {
  const { error } = await (supabase as SupabaseClient)
    .from('job_listings')
    .update({ status: 'active' })
    .eq('id', listingId)
    .eq('brand_id', brandProfileId)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new DiscoveryError('LISTING_NOT_FOUND', 'Listing not found or not owned by this brand')
    }
    throw new DiscoveryError('LISTING_PUBLISH_FAILED', (error as { message: string }).message)
  }
}

export async function getListings(
  supabase: SupabaseClient<Database>
): Promise<JobListingWithBrand[]> {
  // Embed the owning brand profile so callers get the brand's `user_id` (the id
  // every outreach FK actually points at) in the same round-trip — see
  // JobListingWithBrand. Without this, contacting a listing owner is impossible
  // without an N+1 lookup, and the naive `brand_id` guess fails the FK (PR-19).
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('job_listings')
    .select(
      '*, brand_profiles!inner(user_id, company_name, trading_name, logo_url, cover_image_url, description)',
    )

  if (error) {
    throw new DiscoveryError('LISTING_FETCH_FAILED', (error as { message: string }).message)
  }

  type EmbeddedBrand = {
    user_id: string
    company_name: string
    trading_name: string | null
    logo_url: string | null
    cover_image_url: string | null
    description: string | null
  }
  type Embedded = JobListingRow & { brand_profiles?: EmbeddedBrand | EmbeddedBrand[] | null }

  return ((data ?? []) as Embedded[]).map((row) => {
    // PostgREST returns an object for a to-one embed, but an array shape is
    // possible depending on how the relationship is inferred — handle both.
    const { brand_profiles, ...listing } = row
    const brand = Array.isArray(brand_profiles) ? brand_profiles[0] : brand_profiles
    return {
      ...listing,
      brand_user_id: brand?.user_id ?? null,
      brand_name: brand ? (brand.trading_name ?? brand.company_name) : null,
      brand_logo_url: brand?.logo_url ?? null,
      brand_cover_url: brand?.cover_image_url ?? null,
      brand_description: brand?.description ?? null,
    } satisfies JobListingWithBrand
  })
}

// ---------------------------------------------------------------------------
// Paginated discovery feed (FA-5 / SB-9 / FA-4)
// ---------------------------------------------------------------------------

/** Columns the listing card and the discovery filters actually read. */
const LISTING_SUMMARY_COLUMNS = [
  'id',
  'brand_id',
  'title',
  'description',
  'type',
  'status',
  'sport_required',
  'level_required',
  'location',
  'is_remote',
  'pay_type',
  'pay_amount',
  'pay_currency',
  'contract_duration_months',
  'application_deadline',
  'created_at',
].join(', ')

type ListingSummaryKeys =
  | 'id'
  | 'brand_id'
  | 'title'
  | 'description'
  | 'type'
  | 'status'
  | 'sport_required'
  | 'level_required'
  | 'location'
  | 'is_remote'
  | 'pay_type'
  | 'pay_amount'
  | 'pay_currency'
  | 'contract_duration_months'
  | 'application_deadline'
  | 'created_at'

/**
 * A listing as the discovery grid sees it: the projected columns plus the
 * brand's *user* id (see JobListingWithBrand — the id every outreach FK points
 * at). `JobListingWithBrand` is a superset, so existing callers still fit.
 */
export type ListingSummary = Pick<JobListingRow, ListingSummaryKeys> & {
  brand_user_id: string | null
  brand_name: string | null
  brand_logo_url: string | null
  brand_cover_url: string | null
  brand_description: string | null
}

/** Rows per discovery page. */
export const LISTING_PAGE_SIZE = 24

export interface ListingPage {
  listings: ListingSummary[]
  hasMore: boolean
}

/**
 * One bounded page of **active** listings, newest first.
 *
 * FA-5: the discover pages used to pull every listing with `select('*')` and
 * filter `status === 'active'` in JavaScript — fine at 20 rows, an outage at
 * 20,000. Status filtering and ordering now happen in Postgres, only the
 * columns the card renders come back, and `limit + 1` rows are fetched so
 * `hasMore` is exact without a second count query.
 *
 * L-6: listings whose `application_deadline` has passed are excluded here too.
 * The deadline was written by the listing form and projected by this query but
 * never actually filtered on, so an opportunity that closed months ago still
 * occupied the athlete and team feeds. The predicate is the authoritative
 * enforcement — it holds whether or not the optional
 * `expire_listings_past_deadline()` sweep (migration 20260720008000) has run.
 * See listingDeadlineCutoff for the inclusive-of-its-own-day semantics.
 */
export async function getActiveListingsPage(
  supabase: SupabaseClient<Database>,
  options: { limit?: number; offset?: number; now?: Date } = {}
): Promise<ListingPage> {
  const limit = Math.max(1, options.limit ?? LISTING_PAGE_SIZE)
  const offset = Math.max(0, options.offset ?? 0)
  const cutoff = listingDeadlineCutoff(options.now ?? new Date())

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('job_listings')
    .select(
      `${LISTING_SUMMARY_COLUMNS}, brand_profiles!inner(user_id, company_name, trading_name, logo_url, cover_image_url, description)`,
    )
    .eq('status', 'active')
    .or(listingDeadlinePredicate(cutoff))
    .order('created_at', { ascending: false })
    .range(offset, offset + limit)

  if (error) {
    throw new DiscoveryError('LISTING_FETCH_FAILED', (error as { message: string }).message)
  }

  type EmbeddedBrand = {
    user_id: string
    company_name: string
    trading_name: string | null
    logo_url: string | null
    cover_image_url: string | null
    description: string | null
  }
  type Embedded = Pick<JobListingRow, ListingSummaryKeys> & {
    brand_profiles?: EmbeddedBrand | EmbeddedBrand[] | null
  }

  // as unknown as Embedded[]: the column list is built at runtime, so PostgREST's
  // literal-type select parser cannot infer the row shape — Embedded states it.
  const rows = ((data ?? []) as unknown as Embedded[]).map((row) => {
    const { brand_profiles, ...listing } = row
    const brand = Array.isArray(brand_profiles) ? brand_profiles[0] : brand_profiles
    return {
      ...listing,
      brand_user_id: brand?.user_id ?? null,
      brand_name: brand ? (brand.trading_name ?? brand.company_name) : null,
      brand_logo_url: brand?.logo_url ?? null,
      brand_cover_url: brand?.cover_image_url ?? null,
      brand_description: brand?.description ?? null,
    } satisfies ListingSummary
  })

  return { listings: rows.slice(0, limit), hasMore: rows.length > limit }
}

export async function getListing(
  supabase: SupabaseClient<Database>,
  listingId: string
): Promise<JobListingRow | null> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('job_listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new DiscoveryError('LISTING_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as JobListingRow
}

// ---------------------------------------------------------------------------
// Connection Requests
// ---------------------------------------------------------------------------

/**
 * Rejects an application against a listing that is no longer open (L-6).
 *
 * Hiding the card is not enforcement — a stale tab, a bookmarked deep link or a
 * direct POST all reach the API long after the deadline. This is the
 * server-side half.
 *
 * SCHEMA LIMITATION: `connection_requests` has no `listing_id` column (see
 * 20260419000003_discovery.sql) — an application is a plain user→user row — so
 * the database *cannot* express "reject requests against expired listings" as a
 * constraint or an RLS policy, and the API route does not currently know which
 * listing the athlete clicked from. Callers that do know must pass it; see the
 * `listingId` argument on sendConnectionRequest.
 */
export async function assertListingAcceptingApplications(
  supabase: SupabaseClient<Database>,
  listingId: string,
  now: Date = new Date()
): Promise<void> {
  const listing = await getListing(supabase, listingId)

  if (!listing) {
    throw new DiscoveryError('LISTING_NOT_FOUND', 'Listing not found')
  }

  if (!isListingOpenForApplications(listing, now)) {
    throw new DiscoveryError(
      'LISTING_CLOSED',
      'This opportunity is no longer accepting applications'
    )
  }
}

export async function sendConnectionRequest(
  supabase: SupabaseClient<Database>,
  senderId: string,
  recipientId: string,
  message: string,
  /**
   * The listing this application came from, when the caller knows it. Supplying
   * it enforces the listing's status and application deadline server-side; see
   * assertListingAcceptingApplications for why it cannot be enforced in SQL.
   */
  listingId?: string
): Promise<ConnectionRequestRow> {
  // PR-8: bounds live in lib/limits.ts and are mirrored by a DB CHECK
  // constraint. The UI previously demanded >= 300 chars while this rejected
  // > 300, so only an exactly-300-character message could ever be sent.
  const lengthError = checkLength(message, CONNECTION_MESSAGE_BOUNDS, 'Connection request message')
  if (lengthError) {
    const code =
      message.trim().length > CONNECTION_MESSAGE_BOUNDS.max ? 'MESSAGE_TOO_LONG' : 'MESSAGE_TOO_SHORT'
    throw new DiscoveryError(code, lengthError)
  }

  if (senderId === recipientId) {
    throw new DiscoveryError('SELF_CONNECT', 'You cannot send a connection request to yourself')
  }

  if (listingId) {
    await assertListingAcceptingApplications(supabase, listingId)
  }

  const { data, error } = await (supabase as SupabaseClient)
    .from('connection_requests')
    .insert({ sender_id: senderId, recipient_id: recipientId, message })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new DiscoveryError('DUPLICATE_REQUEST', 'A connection request between these users already exists')
    }
    throw new DiscoveryError('REQUEST_CREATE_FAILED', (error as { message: string }).message)
  }

  return data as ConnectionRequestRow
}

export async function respondConnectionRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
  recipientId: string,
  accept: boolean
): Promise<void> {
  const now = new Date().toISOString()
  const update = accept
    ? { status: 'accepted' as const, responded_at: now }
    : { status: 'declined' as const, responded_at: now }

  const { error } = await (supabase as SupabaseClient)
    .from('connection_requests')
    .update(update)
    .eq('id', requestId)
    .eq('recipient_id', recipientId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new DiscoveryError('REQUEST_NOT_FOUND', 'Connection request not found or not accessible')
    }
    throw new DiscoveryError('REQUEST_RESPOND_FAILED', (error as { message: string }).message)
  }
}

export async function withdrawConnectionRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
  senderId: string
): Promise<void> {
  const { error } = await (supabase as SupabaseClient)
    .from('connection_requests')
    .update({ status: 'withdrawn' as const })
    .eq('id', requestId)
    .eq('sender_id', senderId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new DiscoveryError('REQUEST_NOT_FOUND', 'Connection request not found or not accessible')
    }
    throw new DiscoveryError('REQUEST_WITHDRAW_FAILED', (error as { message: string }).message)
  }
}

// ---------------------------------------------------------------------------
// Shortlists
// ---------------------------------------------------------------------------

export async function addToShortlist(
  supabase: SupabaseClient<Database>,
  userId: string,
  targetUserId: string
): Promise<ShortlistRow> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('shortlists')
    .insert({ user_id: userId, target_user_id: targetUserId })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new DiscoveryError('ALREADY_SHORTLISTED', 'This user is already on your shortlist')
    }
    throw new DiscoveryError('SHORTLIST_ADD_FAILED', (error as { message: string }).message)
  }

  return data as ShortlistRow
}

export async function removeFromShortlist(
  supabase: SupabaseClient<Database>,
  userId: string,
  targetUserId: string
): Promise<void> {
  const { error } = await (supabase as SupabaseClient)
    .from('shortlists')
    .delete()
    .eq('user_id', userId)
    .eq('target_user_id', targetUserId)

  if (error) {
    throw new DiscoveryError('SHORTLIST_REMOVE_FAILED', (error as { message: string }).message)
  }
}

export async function getShortlist(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ShortlistRow[]> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('shortlists')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    throw new DiscoveryError('SHORTLIST_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as ShortlistRow[]
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export async function blockUser(
  supabase: SupabaseClient<Database>,
  blockerId: string,
  blockedId: string
): Promise<BlockRow> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new DiscoveryError('ALREADY_BLOCKED', 'You have already blocked this user')
    }
    throw new DiscoveryError('BLOCK_FAILED', (error as { message: string }).message)
  }

  return data as BlockRow
}

export async function unblockUser(
  supabase: SupabaseClient<Database>,
  blockerId: string,
  blockedId: string
): Promise<void> {
  const { error } = await (supabase as SupabaseClient)
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)

  if (error) {
    throw new DiscoveryError('UNBLOCK_FAILED', (error as { message: string }).message)
  }
}

export async function getBlocks(
  supabase: SupabaseClient<Database>,
  blockerId: string
): Promise<BlockRow[]> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('blocks')
    .select('*')
    .eq('blocker_id', blockerId)

  if (error) {
    throw new DiscoveryError('BLOCKS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as BlockRow[]
}
