import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage')
  return { ...actual, createSignedDownloadUrl: vi.fn(async () => 'https://signed.example/export.json') }
})

import { assembleExport, processExportRequest } from './data-export'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Mock admin: table selects resolve from a per-table map; updates are recorded;
 * storage upload is controllable.
 */
function makeAdmin(opts: { tables?: Record<string, unknown[]>; account?: unknown; uploadError?: string } = {}) {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = []
  const tables = opts.tables ?? {}
  let table = ''
  let pendingUpdate: Record<string, unknown> | null = null

  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: table === 'users' ? (opts.account ?? null) : null, error: null })),
    update: vi.fn((payload: Record<string, unknown>) => {
      pendingUpdate = payload
      return builder
    }),
    then(onF: (v: { data: unknown; error: null }) => unknown) {
      if (pendingUpdate) {
        updates.push({ table, payload: pendingUpdate })
        pendingUpdate = null
        return Promise.resolve({ data: null, error: null }).then(onF as never)
      }
      return Promise.resolve({ data: tables[table] ?? [], error: null }).then(onF)
    },
  }

  const admin = {
    from: vi.fn((t: string) => {
      table = t
      pendingUpdate = null
      return builder
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => (opts.uploadError ? { error: { message: opts.uploadError } } : { error: null })),
      })),
    },
  } as unknown as SupabaseClient<Database>

  return { admin, updates }
}

const NOW = '2026-07-28T10:00:00.000Z'

beforeEach(() => vi.clearAllMocks())

describe('assembleExport', () => {
  it('gathers the account and per-table rows, deduping cross-column matches', async () => {
    const { admin } = makeAdmin({
      account: { id: 'u1', email: 'a@x.com' },
      tables: {
        // a match where the user is on both sides resolves to one deduped row
        matches: [{ id: 'm1', user_a_id: 'u1', user_b_id: 'u1' }],
        athlete_profiles: [{ id: 'ap1', user_id: 'u1' }],
      },
    })
    const out = await assembleExport(admin, 'u1', NOW)
    expect(out.userId).toBe('u1')
    expect(out.account).toEqual({ id: 'u1', email: 'a@x.com' })
    expect(out.data.matches).toHaveLength(1)
    expect(out.data.athlete_profiles).toHaveLength(1)
  })
})

describe('processExportRequest', () => {
  it('marks processing then ready with a signed url', async () => {
    const { admin, updates } = makeAdmin({ account: { id: 'u1' }, tables: {} })
    const { downloadUrl } = await processExportRequest(admin, 'req1', 'u1', NOW)

    expect(downloadUrl).toBe('https://signed.example/export.json')
    const statuses = updates.filter((u) => u.table === 'data_export_requests').map((u) => u.payload.status)
    expect(statuses).toContain('processing')
    expect(statuses).toContain('ready')
    const ready = updates.find((u) => u.payload.status === 'ready')!
    expect(ready.payload.download_url).toBe('https://signed.example/export.json')
    expect(ready.payload.expires_at).toBeTruthy()
  })

  it('marks the request failed when the upload fails', async () => {
    const { admin, updates } = makeAdmin({ uploadError: 'bucket exploded' })
    await expect(processExportRequest(admin, 'req1', 'u1', NOW)).rejects.toThrow(/bucket exploded/)
    const statuses = updates.filter((u) => u.table === 'data_export_requests').map((u) => u.payload.status)
    expect(statuses).toContain('failed')
  })
})
