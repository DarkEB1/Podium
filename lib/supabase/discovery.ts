import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']
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

function sanitizeListingData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !LISTING_PROTECTED_FIELDS.has(key)))
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
): Promise<JobListingRow[]> {
  const { data, error } = await (supabase as SupabaseClient).from('job_listings').select('*')

  if (error) {
    throw new DiscoveryError('LISTING_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as JobListingRow[]
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

export async function sendConnectionRequest(
  supabase: SupabaseClient<Database>,
  senderId: string,
  recipientId: string,
  message: string
): Promise<ConnectionRequestRow> {
  if (message.length > 300) {
    throw new DiscoveryError('MESSAGE_TOO_LONG', 'Connection request message must be 300 characters or fewer')
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
