import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'

type ReportRow = Database['public']['Tables']['reports']['Row']
type ReportInsert = Database['public']['Tables']['reports']['Insert']
type AuditLogRow = Database['public']['Tables']['audit_logs']['Row']
type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']
type ReportStatus = Database['public']['Enums']['report_status']
type ReportReason = Database['public']['Enums']['report_reason']
type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type JobListingRow = Database['public']['Tables']['job_listings']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type ProfileStatus = Database['public']['Enums']['profile_status']
type BrandStatus = Database['public']['Enums']['brand_status']

export type AdminProfileType = 'athlete' | 'brand'
export type AdminProfileStatus = ProfileStatus | BrandStatus

export class AdminError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AdminError'
  }
}

export interface CreateReportPayload {
  reported_user_id?: string | null
  reported_message_id?: string | null
  reason: ReportReason
  detail?: string | null
}

export interface ResolveReportPayload {
  status: ReportStatus
  admin_notes?: string | null
}

export interface GetReportsOptions {
  status?: ReportStatus
}

export interface GetAuditLogsOptions {
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function getReports(
  adminSupabase: SupabaseClient<Database>,
  options: GetReportsOptions = {}
): Promise<ReportRow[]> {
  let query = db(adminSupabase)
    .from('reports')
    .select('*')

  if (options.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new AdminError('REPORTS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as ReportRow[]
}

export async function getOwnReports(
  supabase: SupabaseClient<Database>,
  reporterId: string
): Promise<ReportRow[]> {
  const { data, error } = await db(supabase)
    .from('reports')
    .select('*')
    .eq('reporter_id', reporterId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new AdminError('REPORTS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as ReportRow[]
}

export async function getReport(
  adminSupabase: SupabaseClient<Database>,
  reportId: string
): Promise<ReportRow> {
  const { data, error } = await db(adminSupabase)
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new AdminError('REPORT_NOT_FOUND', 'Report not found')
    }
    throw new AdminError('REPORT_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as ReportRow
}

export async function createReport(
  supabase: SupabaseClient<Database>,
  reporterId: string,
  payload: CreateReportPayload
): Promise<ReportRow> {
  const insert: ReportInsert = {
    reporter_id: reporterId,
    reason: payload.reason,
    ...(payload.reported_user_id !== undefined ? { reported_user_id: payload.reported_user_id } : {}),
    ...(payload.reported_message_id !== undefined ? { reported_message_id: payload.reported_message_id } : {}),
    ...(payload.detail !== undefined ? { detail: payload.detail } : {}),
  }

  const { data, error } = await db(supabase)
    .from('reports')
    .insert(insert)
    .select()
    .single()

  if (error) {
    throw new AdminError('REPORT_CREATE_FAILED', (error as { message: string }).message)
  }

  return data as ReportRow
}

export async function resolveReport(
  adminSupabase: SupabaseClient<Database>,
  reportId: string,
  adminId: string,
  payload: ResolveReportPayload
): Promise<ReportRow> {
  const now = new Date().toISOString()

  const updatePayload: Record<string, unknown> = {
    status: payload.status,
    resolved_by: adminId,
    resolved_at: now,
    ...(payload.admin_notes !== undefined ? { admin_notes: payload.admin_notes } : {}),
  }

  const { data, error } = await db(adminSupabase)
    .from('reports')
    .update(updatePayload)
    .eq('id', reportId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new AdminError('REPORT_NOT_FOUND', 'Report not found')
    }
    throw new AdminError('REPORT_UPDATE_FAILED', (error as { message: string }).message)
  }

  return data as ReportRow
}

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export async function getAuditLogs(
  adminSupabase: SupabaseClient<Database>,
  options: GetAuditLogsOptions = {}
): Promise<AuditLogRow[]> {
  const limit = options.limit ?? 50
  const offset = options.offset ?? 0

  const { data, error } = await db(adminSupabase)
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new AdminError('AUDIT_LOGS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as AuditLogRow[]
}

export async function createAuditLog(
  adminSupabase: SupabaseClient<Database>,
  payload: Omit<AuditLogInsert, 'id' | 'created_at'>
): Promise<AuditLogRow> {
  const { data, error } = await db(adminSupabase)
    .from('audit_logs')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw new AdminError('AUDIT_LOG_CREATE_FAILED', (error as { message: string }).message)
  }

  return data as AuditLogRow
}

// ---------------------------------------------------------------------------
// Profile Management (Admin)
// ---------------------------------------------------------------------------

export async function getAllAthleteProfiles(
  adminSupabase: SupabaseClient<Database>
): Promise<AthleteRow[]> {
  const { data, error } = await (adminSupabase as SupabaseClient)
    .from('athlete_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new AdminError('ATHLETE_FETCH_FAILED', (error as { message: string }).message)
  return (data ?? []) as AthleteRow[]
}

export async function getAllBrandProfiles(
  adminSupabase: SupabaseClient<Database>
): Promise<BrandRow[]> {
  const { data, error } = await (adminSupabase as SupabaseClient)
    .from('brand_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new AdminError('BRAND_FETCH_FAILED', (error as { message: string }).message)
  return (data ?? []) as BrandRow[]
}

export async function getAllUsers(
  adminSupabase: SupabaseClient<Database>
): Promise<UserRow[]> {
  const { data, error } = await (adminSupabase as SupabaseClient)
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new AdminError('USERS_FETCH_FAILED', (error as { message: string }).message)
  return (data ?? []) as UserRow[]
}

export async function getAllListings(
  adminSupabase: SupabaseClient<Database>
): Promise<JobListingRow[]> {
  const { data, error } = await (adminSupabase as SupabaseClient)
    .from('job_listings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new AdminError('LISTINGS_FETCH_FAILED', (error as { message: string }).message)
  return (data ?? []) as JobListingRow[]
}

export async function getPendingCount(
  adminSupabase: SupabaseClient<Database>
): Promise<{ athletes: number; brands: number }> {
  const [athleteRes, brandRes] = await Promise.all([
    (adminSupabase as SupabaseClient)
      .from('athlete_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    (adminSupabase as SupabaseClient)
      .from('brand_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval'),
  ])

  if (athleteRes.error) throw new AdminError('PENDING_COUNT_FAILED', (athleteRes.error as { message: string }).message)
  if (brandRes.error) throw new AdminError('PENDING_COUNT_FAILED', (brandRes.error as { message: string }).message)

  return {
    athletes: athleteRes.count ?? 0,
    brands: brandRes.count ?? 0,
  }
}

export async function getAthleteProfileById(
  adminSupabase: SupabaseClient<Database>,
  id: string
): Promise<AthleteRow | null> {
  const { data, error } = await (adminSupabase as SupabaseClient)
    .from('athlete_profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new AdminError('ATHLETE_FETCH_FAILED', (error as { message: string }).message)
  }
  return data as AthleteRow
}

export async function getBrandProfileById(
  adminSupabase: SupabaseClient<Database>,
  id: string
): Promise<BrandRow | null> {
  const { data, error } = await (adminSupabase as SupabaseClient)
    .from('brand_profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new AdminError('BRAND_FETCH_FAILED', (error as { message: string }).message)
  }
  return data as BrandRow
}

export async function updateProfileStatus(
  adminSupabase: SupabaseClient<Database>,
  id: string,
  profileType: AdminProfileType,
  status: AdminProfileStatus,
  adminId: string
): Promise<void> {
  if (profileType === 'athlete') {
    const athleteStatus = status as ProfileStatus
    const { error } = await (adminSupabase as SupabaseClient)
      .from('athlete_profiles')
      .update({
        status: athleteStatus,
        ...(athleteStatus === 'active' ? { admin_approved_at: new Date().toISOString(), admin_approved_by: adminId } : {}),
      })
      .eq('id', id)

    if (error) throw new AdminError('STATUS_UPDATE_FAILED', (error as { message: string }).message)
  } else {
    const brandStatus = status as BrandStatus
    const { error } = await (adminSupabase as SupabaseClient)
      .from('brand_profiles')
      .update({
        status: brandStatus,
        ...(brandStatus === 'active' ? { admin_approved_at: new Date().toISOString(), admin_approved_by: adminId } : {}),
      })
      .eq('id', id)

    if (error) throw new AdminError('STATUS_UPDATE_FAILED', (error as { message: string }).message)
  }
}
