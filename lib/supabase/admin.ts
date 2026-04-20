import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type ReportRow = Database['public']['Tables']['reports']['Row']
type ReportInsert = Database['public']['Tables']['reports']['Insert']
type AuditLogRow = Database['public']['Tables']['audit_logs']['Row']
type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']
type ReportStatus = Database['public']['Enums']['report_status']
type ReportReason = Database['public']['Enums']['report_reason']

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
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  let query = (adminSupabase as SupabaseClient)
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
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
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
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (adminSupabase as SupabaseClient)
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

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
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

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (adminSupabase as SupabaseClient)
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

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (adminSupabase as SupabaseClient)
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
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (adminSupabase as SupabaseClient)
    .from('audit_logs')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw new AdminError('AUDIT_LOG_CREATE_FAILED', (error as { message: string }).message)
  }

  return data as AuditLogRow
}
