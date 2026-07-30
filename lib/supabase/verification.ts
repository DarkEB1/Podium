import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Verification badges (spec §6A / trust).
 *
 * verification_requests is the source of truth: a user is "verified" when an
 * approved row exists. Users request; admins review. A KYC provider can later
 * pre-fill evidence and auto-approve, but nothing here requires one.
 */

export type VerificationRow = Database['public']['Tables']['verification_requests']['Row']

export class VerificationError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'VerificationError'
  }
}

/** Create a pending verification request. Blocked if one is already pending. */
export async function requestVerification(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: string,
  note?: string
): Promise<VerificationRow> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('verification_requests')
    .insert({ user_id: userId, role, note: note ?? null })
    .select()
    .single()

  if (error) {
    // The partial unique index rejects a second pending request.
    if ((error as { code?: string }).code === '23505') {
      throw new VerificationError('ALREADY_PENDING', 'You already have a verification request in review')
    }
    throw new VerificationError('REQUEST_FAILED', (error as { message: string }).message)
  }
  return data as VerificationRow
}

/** The caller's latest verification request, if any. */
export async function getLatestVerification(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<VerificationRow | null> {
  const { data } = await (supabase as SupabaseClient)
    .from('verification_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as VerificationRow | null) ?? null
}

/** Whether a user is verified (has an approved request). */
export async function isVerified(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { data } = await (supabase as SupabaseClient)
    .from('verification_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle()
  return !!data
}

/** The set of verified user ids among the given ids (for annotating a feed). */
export async function getVerifiedUserIds(
  supabase: SupabaseClient<Database>,
  userIds: string[]
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const { data } = await (supabase as SupabaseClient)
    .from('verification_requests')
    .select('user_id')
    .eq('status', 'approved')
    .in('user_id', userIds)
  const rows = (data as { user_id: string }[] | null) ?? []
  return new Set(rows.map((r) => r.user_id))
}

/** Admin: the pending review queue, oldest first. */
export async function listPendingVerifications(
  admin: SupabaseClient<Database>
): Promise<VerificationRow[]> {
  const { data } = await (admin as SupabaseClient)
    .from('verification_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return (data as VerificationRow[] | null) ?? []
}

/**
 * Admin: approve or reject a request.
 *
 * QA-3.1: agents are the one role that also carries verification on their own
 * profile (`agent_profiles.verification_status` / `is_verified`, which is what
 * the agent profile and settings screens render, and what `applyForVerification`
 * moves to 'pending'). An approval that updated only verification_requests left
 * those columns saying "unverified" forever, so an approved agent saw no change
 * anywhere. Athletes, teams and brands have no such column: for them
 * verification_requests IS the source of truth and the read helpers above are
 * what surface it.
 *
 * The write-back is best-effort and runs after the review is recorded: the
 * review itself must not fail because a mirror column could not be updated.
 */
export async function reviewVerification(
  admin: SupabaseClient<Database>,
  requestId: string,
  reviewerId: string,
  action: 'approve' | 'reject',
  reviewNote?: string
): Promise<VerificationRow> {
  const reviewedAt = new Date().toISOString()

  const { data, error } = await (admin as SupabaseClient)
    .from('verification_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt,
      review_note: reviewNote ?? null,
    })
    .eq('id', requestId)
    .select()
    .single()

  if (error) throw new VerificationError('REVIEW_FAILED', (error as { message: string }).message)

  const review = data as VerificationRow

  if (review.role === 'agent') {
    await (admin as SupabaseClient)
      .from('agent_profiles')
      .update(
        action === 'approve'
          ? { verification_status: 'verified', is_verified: true, verified_at: reviewedAt }
          // agent_verification_status is the tri-state unverified/pending/verified
          // (20260419000012) with no 'rejected' member, so a rejection returns the
          // agent to 'unverified' rather than inventing a fourth state. The reason
          // lives on the verification_requests row.
          : { verification_status: 'unverified', is_verified: false, verified_at: null }
      )
      .eq('user_id', review.user_id)
  }

  return review
}
