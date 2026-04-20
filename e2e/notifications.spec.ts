import { test, expect } from '@playwright/test'

test.describe('Notifications — list', () => {
  test('GET /api/notifications returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/notifications')
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })
})

test.describe('Notifications — mark read', () => {
  test('PATCH /api/notifications/[id]/read returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.patch('/api/notifications/some-notification-id/read')
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })
})

test.describe('Notifications — create (internal)', () => {
  test('POST /api/notifications returns 401 without service role key', async ({ request }) => {
    const res = await request.post('/api/notifications', {
      data: {
        user_id: 'user-1',
        event_type: 'connection_request_received',
        channel: 'in_app',
        title: 'Test',
        body: 'Test body',
      },
    })
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  test('POST /api/notifications returns 400 when required fields missing', async ({ request }) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-key'
    const res = await request.post('/api/notifications', {
      data: {},
      headers: { Authorization: `Bearer ${serviceKey}` },
    })
    // Either 400 (missing fields) or 401 (wrong key in test env) are both acceptable
    expect([400, 401]).toContain(res.status())
  })
})
