import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { STORAGE_BUCKETS, createSignedDownloadUrl } from '@/lib/storage'
import { captureException } from '@/lib/observability'

/**
 * GDPR "download my data" fulfilment (spec §privacy, Art. 20 portability).
 *
 * requestDataExport() only ever inserted a `pending` row; nothing produced the
 * file. This module assembles the user's data as JSON, stores it in the private
 * `exports` bucket, signs a 72h download URL, and marks the request ready. It is
 * driven by the data-export cron. Service-role only.
 *
 * QA-1.7: the upload originally targeted the `docs` bucket, which accepts only
 * images and PDF, so Storage rejected every export with invalid_mime_type and no
 * request could ever succeed. Exports now have their own owner-only bucket
 * (migration 20260730000400).
 */

const DOWNLOAD_TTL_SECONDS = 72 * 60 * 60

// Personal-data tables keyed by user_id, plus the direction column where a user
// can appear on either side. `users` is fetched separately by primary key.
const USER_TABLES: { table: string; columns: readonly string[] }[] = [
  { table: 'athlete_profiles', columns: ['user_id'] },
  { table: 'team_profiles', columns: ['user_id'] },
  { table: 'brand_profiles', columns: ['user_id'] },
  { table: 'agent_profiles', columns: ['user_id'] },
  { table: 'profile_settings', columns: ['user_id'] },
  { table: 'connection_requests', columns: ['sender_id', 'recipient_id'] },
  { table: 'matches', columns: ['user_a_id', 'user_b_id'] },
  { table: 'proposals', columns: ['sender_id'] },
  { table: 'contracts', columns: ['brand_id', 'athlete_or_team_id'] },
  { table: 'payments', columns: ['payer_id', 'payee_id'] },
  { table: 'shortlists', columns: ['owner_id', 'target_user_id'] },
  { table: 'notification_logs', columns: ['user_id'] },
  { table: 'login_history', columns: ['user_id'] },
  { table: 'active_sessions', columns: ['user_id'] },
]

export interface DataExport {
  generatedAt: string
  userId: string
  account: unknown
  data: Record<string, unknown[]>
}

/** Gather everything Podium holds about a user into one JSON-serialisable object. */
export async function assembleExport(
  admin: SupabaseClient<Database>,
  userId: string,
  nowIso: string
): Promise<DataExport> {
  const client = admin as SupabaseClient

  const { data: account } = await client.from('users').select('*').eq('id', userId).maybeSingle()

  const data: Record<string, unknown[]> = {}
  for (const { table, columns } of USER_TABLES) {
    const rows: unknown[] = []
    const seen = new Set<string>()
    for (const column of columns) {
      const { data: part } = await client.from(table).select('*').eq(column, userId)
      for (const row of (part as { id?: string }[] | null) ?? []) {
        // A row can match on two columns (e.g. both sides of a match); dedupe by id.
        const key = row.id ?? JSON.stringify(row)
        if (seen.has(key)) continue
        seen.add(key)
        rows.push(row)
      }
    }
    if (rows.length > 0) data[table] = rows
  }

  return { generatedAt: nowIso, userId, account: account ?? null, data }
}

/**
 * Process one export request end to end: assemble, upload, sign, mark ready.
 * Any failure marks the request `failed` and rethrows so the cron can log it.
 */
export async function processExportRequest(
  admin: SupabaseClient<Database>,
  requestId: string,
  userId: string,
  nowIso: string
): Promise<{ downloadUrl: string }> {
  const client = admin as SupabaseClient
  try {
    await client.from('data_export_requests').update({ status: 'processing' }).eq('id', requestId)

    const payload = await assembleExport(admin, userId, nowIso)
    // Owner id is the FIRST path segment, which is what the bucket's
    // owner-scoped SELECT policy matches on. The old `exports/<uid>/...` shape
    // put a literal folder name there, so no owner policy could apply.
    const path = `${userId}/${requestId}.json`

    const { error: uploadError } = await client.storage
      .from(STORAGE_BUCKETS.exports)
      .upload(path, JSON.stringify(payload, null, 2), {
        contentType: 'application/json',
        upsert: true,
      })
    if (uploadError) throw new Error(uploadError.message)

    const downloadUrl = await createSignedDownloadUrl(admin, STORAGE_BUCKETS.exports, path, DOWNLOAD_TTL_SECONDS)
    const expiresAt = new Date(new Date(nowIso).getTime() + DOWNLOAD_TTL_SECONDS * 1000).toISOString()

    await client
      .from('data_export_requests')
      .update({ status: 'ready', download_url: downloadUrl, completed_at: nowIso, expires_at: expiresAt })
      .eq('id', requestId)

    return { downloadUrl }
  } catch (err) {
    await client.from('data_export_requests').update({ status: 'failed' }).eq('id', requestId)
    throw err
  }
}

export type DataExportRequestRow = Database['public']['Tables']['data_export_requests']['Row']

/** The caller's most recent export request, if any (RLS scopes to own rows). */
export async function getLatestDataExport(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<DataExportRequestRow | null> {
  const { data } = await (supabase as SupabaseClient)
    .from('data_export_requests')
    .select('*')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as DataExportRequestRow | null) ?? null
}

/** Process up to `limit` pending export requests. Returns how many succeeded/failed. */
export async function processPendingExports(
  admin: SupabaseClient<Database>,
  nowIso: string,
  limit = 25
): Promise<{ processed: number; failed: number }> {
  const client = admin as SupabaseClient
  const { data } = await client
    .from('data_export_requests')
    .select('id, user_id')
    .eq('status', 'pending')
    .limit(limit)

  const rows = (data as { id: string; user_id: string }[] | null) ?? []
  let processed = 0
  let failed = 0
  for (const row of rows) {
    try {
      await processExportRequest(admin, row.id, row.user_id, nowIso)
      processed++
    } catch (err) {
      // The failure used to be discarded entirely, so a permanently broken
      // export looked like a bare {"failed":1} with no way to find out why.
      // Never log the request's contents, only which request and what broke.
      captureException(err, { stage: 'processPendingExports', requestId: row.id })
      failed++
    }
  }
  return { processed, failed }
}
