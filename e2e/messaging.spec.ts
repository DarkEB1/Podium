import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

async function createUserAndLogin(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  role: string,
  tag: string
) {
  const email = `e2e-messaging-${tag}-${Date.now()}@example.com`
  const password = 'TestPass1!'

  await request.post(`${BASE}/api/auth/signup`, { data: { email, password } })
  await request.post(`${BASE}/api/auth/login`, { data: { email, password } })
  await request.post(`${BASE}/api/auth/role`, { data: { role } })

  const meRes = await request.get(`${BASE}/api/auth/me`)
  const me = await meRes.json()
  return { email, password, id: me.id as string }
}

test.describe('Messaging API — happy path', () => {
  test('list matches returns empty array for new user', async ({ request }) => {
    await createUserAndLogin(request, 'athlete', 'list-matches')

    const res = await request.get(`${BASE}/api/messaging/matches`)
    expect(res.ok()).toBeTruthy()
    const matches = await res.json()
    expect(Array.isArray(matches)).toBe(true)
  })

  test('unauthenticated requests return 401', async ({ request }) => {
    const matchesRes = await request.get(`${BASE}/api/messaging/matches`)
    expect(matchesRes.status()).toBe(401)

    const msgRes = await request.get(`${BASE}/api/messaging/matches/fake-id/messages`)
    expect(msgRes.status()).toBe(401)

    const sendRes = await request.post(`${BASE}/api/messaging/matches/fake-id/messages`, {
      data: { content_type: 'text' },
    })
    expect(sendRes.status()).toBe(401)

    const deleteRes = await request.delete(
      `${BASE}/api/messaging/matches/fake-id/messages/fake-msg`
    )
    expect(deleteRes.status()).toBe(401)
  })

  test('send message to non-existent match returns 404', async ({ request }) => {
    await createUserAndLogin(request, 'brand', 'no-match')

    const res = await request.post(
      `${BASE}/api/messaging/matches/00000000-0000-0000-0000-000000000000/messages`,
      { data: { content_type: 'text', text_content: 'Hello' } }
    )
    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('MATCH_NOT_FOUND')
  })

  test('get messages for non-existent match returns 404', async ({ request }) => {
    await createUserAndLogin(request, 'athlete', 'get-msgs-no-match')

    const res = await request.get(
      `${BASE}/api/messaging/matches/00000000-0000-0000-0000-000000000000/messages`
    )
    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('MATCH_NOT_FOUND')
  })

  test('send message missing content_type returns 400', async ({ request }) => {
    await createUserAndLogin(request, 'brand', 'missing-ct')

    const res = await request.post(
      `${BASE}/api/messaging/matches/00000000-0000-0000-0000-000000000000/messages`,
      { data: {} }
    )
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })
})
