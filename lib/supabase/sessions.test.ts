import { describe, it, expect, vi } from 'vitest'
import {
  deviceLabel,
  sessionTokenHash,
  recordLogin,
  recordFailedLogin,
  clearSession,
} from './sessions'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function makeAdmin() {
  const inserts: Array<{ table: string; payload: unknown }> = []
  const upserts: Array<{ table: string; payload: unknown }> = []
  const deletes: Array<{ table: string; filters: Record<string, unknown> }> = []
  let table = ''
  let delFilters: Record<string, unknown> = {}

  const builder: Record<string, unknown> = {
    insert: vi.fn((payload: unknown) => {
      inserts.push({ table, payload })
      return Promise.resolve({ error: null })
    }),
    upsert: vi.fn((payload: unknown) => {
      upserts.push({ table, payload })
      return Promise.resolve({ error: null })
    }),
    delete: vi.fn(() => {
      delFilters = {}
      return builder
    }),
    eq: vi.fn((col: string, val: unknown) => {
      delFilters[col] = val
      return builder
    }),
    then(onF: (v: { error: null }) => unknown) {
      deletes.push({ table, filters: { ...delFilters } })
      return Promise.resolve({ error: null }).then(onF)
    },
  }

  const admin = {
    from: vi.fn((t: string) => {
      table = t
      return builder
    }),
  } as unknown as SupabaseClient<Database>

  return { admin, inserts, upserts, deletes }
}

describe('deviceLabel', () => {
  it('parses common browser/OS pairs', () => {
    expect(deviceLabel('Mozilla/5.0 (Macintosh) Chrome/120 Safari/537')).toBe('Chrome on macOS')
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10) Firefox/121')).toBe('Firefox on Windows')
    expect(deviceLabel('')).toBe('Browser on Unknown OS')
  })
})

describe('sessionTokenHash', () => {
  it('is a stable 64-hex hash that is not the raw token', () => {
    const h = sessionTokenHash('refresh-abc')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toBe('refresh-abc')
    expect(sessionTokenHash('refresh-abc')).toBe(h)
  })
})

describe('recordLogin', () => {
  it('writes a successful login_history row and upserts a session (hashed token)', async () => {
    const m = makeAdmin()
    await recordLogin(m.admin, 'u1', { ip: '1.2.3.4', userAgent: 'Chrome/120 (Windows)', refreshToken: 'rt' })

    const hist = m.inserts.find((i) => i.table === 'login_history')!
    expect((hist.payload as { success: boolean }).success).toBe(true)

    const sess = m.upserts.find((u) => u.table === 'active_sessions')!
    const payload = sess.payload as { session_token: string; device_label: string }
    expect(payload.session_token).toBe(sessionTokenHash('rt'))
    expect(payload.session_token).not.toBe('rt')
    expect(payload.device_label).toContain('on')
  })

  it('skips the session upsert when no refresh token is available', async () => {
    const m = makeAdmin()
    await recordLogin(m.admin, 'u1', { ip: null, userAgent: null })
    expect(m.upserts).toHaveLength(0)
    expect(m.inserts).toHaveLength(1)
  })
})

describe('recordFailedLogin', () => {
  it('writes a failed login_history row', async () => {
    const m = makeAdmin()
    await recordFailedLogin(m.admin, 'u1', { ip: '9.9.9.9', userAgent: 'x' })
    const hist = m.inserts.find((i) => i.table === 'login_history')!
    expect((hist.payload as { success: boolean }).success).toBe(false)
  })
})

describe('clearSession', () => {
  it('deletes the active session for the current hashed token', async () => {
    const m = makeAdmin()
    await clearSession(m.admin, 'u1', 'rt')
    const del = m.deletes.find((d) => d.table === 'active_sessions')!
    expect(del.filters.user_id).toBe('u1')
    expect(del.filters.session_token).toBe(sessionTokenHash('rt'))
  })
})
