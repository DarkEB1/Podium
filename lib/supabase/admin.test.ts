import { describe, it, expect, vi } from 'vitest'
import {
  getReports,
  getOwnReports,
  getReport,
  createReport,
  resolveReport,
  getAuditLogs,
  createAuditLog,
  AdminError,
} from './admin'

function makeClient(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    ...overrides,
  }
  return { from: vi.fn().mockReturnValue(chain), _chain: chain }
}

const fakeReport = {
  id: 'report-1',
  reporter_id: 'user-1',
  reported_user_id: 'user-2',
  reported_message_id: null,
  reason: 'spam' as const,
  detail: 'Too many promos',
  status: 'pending' as const,
  admin_notes: null,
  resolved_by: null,
  resolved_at: null,
  created_at: '2026-04-20T10:00:00Z',
  updated_at: '2026-04-20T10:00:00Z',
}

const fakeAuditLog = {
  id: 'audit-1',
  actor_id: 'admin-user-1',
  action: 'user.suspended',
  target_type: 'user',
  target_id: 'user-2',
  metadata: {},
  ip_address: null,
  created_at: '2026-04-20T10:00:00Z',
}

// ---------------------------------------------------------------------------
// getReports
// ---------------------------------------------------------------------------

describe('getReports', () => {
  it('returns all reports without filter', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [fakeReport], error: null })

    const result = await getReports(client as never)

    expect(client.from).toHaveBeenCalledWith('reports')
    expect(result).toEqual([fakeReport])
    expect(_chain.eq).not.toHaveBeenCalled()
  })

  it('filters by status when provided', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [fakeReport], error: null })

    await getReports(client as never, { status: 'pending' })

    expect(_chain.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('returns empty array when no reports', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })

    const result = await getReports(client as never)

    expect(result).toEqual([])
  })

  it('throws AdminError on db error', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'db failure' } })

    await expect(getReports(client as never)).rejects.toThrow(AdminError)
  })
})

// ---------------------------------------------------------------------------
// getOwnReports
// ---------------------------------------------------------------------------

describe('getOwnReports', () => {
  it('scopes query to reporter_id', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [fakeReport], error: null })

    const result = await getOwnReports(client as never, 'user-1')

    expect(client.from).toHaveBeenCalledWith('reports')
    expect(_chain.eq).toHaveBeenCalledWith('reporter_id', 'user-1')
    expect(result).toEqual([fakeReport])
  })

  it('returns empty array when reporter has no reports', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })

    const result = await getOwnReports(client as never, 'user-1')
    expect(result).toEqual([])
  })

  it('throws AdminError on db error', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'db failure' } })

    await expect(getOwnReports(client as never, 'user-1')).rejects.toThrow(AdminError)
  })
})

// ---------------------------------------------------------------------------
// getReport
// ---------------------------------------------------------------------------

describe('getReport', () => {
  it('returns a single report', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeReport, error: null })

    const result = await getReport(client as never, 'report-1')

    expect(_chain.eq).toHaveBeenCalledWith('id', 'report-1')
    expect(result).toEqual(fakeReport)
  })

  it('throws REPORT_NOT_FOUND on PGRST116', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

    await expect(getReport(client as never, 'missing')).rejects.toThrow(AdminError)
    await expect(getReport(client as never, 'missing')).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' })
  })

  it('throws AdminError on other db errors', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'db failure' } })

    await expect(getReport(client as never, 'report-1')).rejects.toThrow(AdminError)
  })
})

// ---------------------------------------------------------------------------
// createReport
// ---------------------------------------------------------------------------

describe('createReport', () => {
  it('inserts a report and returns it', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeReport, error: null })

    const result = await createReport(client as never, 'user-1', {
      reported_user_id: 'user-2',
      reason: 'spam',
    })

    expect(client.from).toHaveBeenCalledWith('reports')
    expect(_chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ reporter_id: 'user-1', reported_user_id: 'user-2', reason: 'spam' })
    )
    expect(result).toEqual(fakeReport)
  })

  it('throws AdminError on insert failure', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'insert failed' } })

    await expect(
      createReport(client as never, 'user-1', { reported_user_id: 'user-2', reason: 'spam' })
    ).rejects.toThrow(AdminError)
  })
})

// ---------------------------------------------------------------------------
// resolveReport
// ---------------------------------------------------------------------------

describe('resolveReport', () => {
  it('updates report status and returns updated row', async () => {
    const resolved = { ...fakeReport, status: 'resolved' as const, resolved_by: 'admin-1', resolved_at: '2026-04-20T11:00:00Z' }
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: resolved, error: null })

    const result = await resolveReport(client as never, 'report-1', 'admin-1', {
      status: 'resolved',
      admin_notes: 'Confirmed spam',
    })

    expect(_chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved', admin_notes: 'Confirmed spam', resolved_by: 'admin-1' })
    )
    expect(_chain.eq).toHaveBeenCalledWith('id', 'report-1')
    expect(result).toEqual(resolved)
  })

  it('throws REPORT_NOT_FOUND on PGRST116', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

    await expect(
      resolveReport(client as never, 'missing', 'admin-1', { status: 'dismissed' })
    ).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' })
  })

  it('throws AdminError on other db errors', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'update failed' } })

    await expect(
      resolveReport(client as never, 'report-1', 'admin-1', { status: 'resolved' })
    ).rejects.toThrow(AdminError)
  })
})

// ---------------------------------------------------------------------------
// getAuditLogs
// ---------------------------------------------------------------------------

describe('getAuditLogs', () => {
  it('returns audit logs in descending order', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.range as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [fakeAuditLog], error: null })

    const result = await getAuditLogs(client as never)

    expect(client.from).toHaveBeenCalledWith('audit_logs')
    expect(_chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual([fakeAuditLog])
  })

  it('applies pagination via range', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.range as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [fakeAuditLog], error: null })

    await getAuditLogs(client as never, { limit: 10, offset: 20 })

    expect(_chain.range).toHaveBeenCalledWith(20, 29)
  })

  it('uses default limit of 50', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.range as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null })

    await getAuditLogs(client as never, { offset: 0 })

    expect(_chain.range).toHaveBeenCalledWith(0, 49)
  })

  it('returns empty array when no logs', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.range as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })

    const result = await getAuditLogs(client as never)
    expect(result).toEqual([])
  })

  it('throws AdminError on db error', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.range as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'db failure' } })

    await expect(getAuditLogs(client as never)).rejects.toThrow(AdminError)
  })
})

// ---------------------------------------------------------------------------
// createAuditLog
// ---------------------------------------------------------------------------

describe('createAuditLog', () => {
  it('inserts an audit log entry and returns it', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: fakeAuditLog, error: null })

    const result = await createAuditLog(client as never, {
      actor_id: 'admin-user-1',
      action: 'user.suspended',
      target_type: 'user',
      target_id: 'user-2',
    })

    expect(client.from).toHaveBeenCalledWith('audit_logs')
    expect(_chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.suspended', target_type: 'user', target_id: 'user-2' })
    )
    expect(result).toEqual(fakeAuditLog)
  })

  it('throws AdminError on insert failure', async () => {
    const { _chain, ...client } = makeClient()
    ;(_chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'insert failed' } })

    await expect(
      createAuditLog(client as never, { action: 'test.action', target_type: 'user', target_id: 'user-1' })
    ).rejects.toThrow(AdminError)
  })
})
