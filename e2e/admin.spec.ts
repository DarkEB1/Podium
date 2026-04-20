import { test, expect } from '@playwright/test'

test.describe('Admin — reports (user-facing)', () => {
  test('GET /api/reports returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/reports')
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  test('POST /api/reports returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/reports', {
      data: { reported_user_id: 'some-user', reason: 'spam' },
    })
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  test('POST /api/reports returns 401 when unauthenticated (even with missing reason)', async ({ request }) => {
    // Auth check runs before field validation — unauthenticated requests always get 401
    const res = await request.post('/api/reports', {
      data: { reported_user_id: 'some-user' },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('Admin — reports (admin-only)', () => {
  test('GET /api/admin/reports returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/admin/reports')
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  test('GET /api/admin/reports/[id] returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/admin/reports/some-report-id')
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  test('PATCH /api/admin/reports/[id] returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.patch('/api/admin/reports/some-report-id', {
      data: { status: 'resolved' },
    })
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })
})

test.describe('Admin — audit logs', () => {
  test('GET /api/admin/audit-logs returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/admin/audit-logs')
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  test('POST /api/admin/audit-logs returns 401 without service role key', async ({ request }) => {
    const res = await request.post('/api/admin/audit-logs', {
      data: { action: 'user.suspended', target_type: 'user', target_id: 'some-user' },
    })
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  test('POST /api/admin/audit-logs returns 400 when required fields missing (with valid key)', async ({ request }) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return // skip in environments where key is unavailable
    const res = await request.post('/api/admin/audit-logs', {
      data: {},
      headers: { Authorization: `Bearer ${serviceKey}` },
    })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })
})
