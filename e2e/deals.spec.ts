import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

async function createUserAndLogin(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  role: string,
  tag: string
) {
  const email = `e2e-deals-${tag}-${Date.now()}@example.com`
  const password = 'TestPass1!'

  await request.post(`${BASE}/api/auth/signup`, { data: { email, password } })
  await request.post(`${BASE}/api/auth/login`, { data: { email, password } })
  await request.post(`${BASE}/api/auth/role`, { data: { role } })

  const meRes = await request.get(`${BASE}/api/auth/me`)
  const me = await meRes.json()
  return { email, password, id: me.id as string }
}

test.describe('Deals API — happy path', () => {
  test('unauthenticated requests return 401', async ({ request }) => {
    const listRes = await request.get(`${BASE}/api/deals/proposals?matchId=fake`)
    expect(listRes.status()).toBe(401)

    const sendRes = await request.post(`${BASE}/api/deals/proposals`, {
      data: { match_id: 'fake', title: 'Test', pay_amount: 100, pay_type: 'flat_fee' },
    })
    expect(sendRes.status()).toBe(401)

    const respondRes = await request.post(
      `${BASE}/api/deals/proposals/fake-id/respond`,
      { data: { action: 'accepted' } }
    )
    expect(respondRes.status()).toBe(401)

    const counterRes = await request.post(
      `${BASE}/api/deals/proposals/fake-id/counter`,
      { data: { title: 'Counter', pay_amount: 200, pay_type: 'flat_fee' } }
    )
    expect(counterRes.status()).toBe(401)

    const deleteRes = await request.delete(`${BASE}/api/deals/proposals/fake-id`)
    expect(deleteRes.status()).toBe(401)

    const contractRes = await request.get(`${BASE}/api/deals/proposals/fake-id/contract`)
    expect(contractRes.status()).toBe(401)
  })

  test('getProposals with missing matchId returns 400', async ({ request }) => {
    await createUserAndLogin(request, 'brand', 'missing-match')

    const res = await request.get(`${BASE}/api/deals/proposals`)
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  test('getProposals for non-existent match returns 404', async ({ request }) => {
    await createUserAndLogin(request, 'brand', 'no-match')

    const res = await request.get(
      `${BASE}/api/deals/proposals?matchId=00000000-0000-0000-0000-000000000000`
    )
    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('MATCH_NOT_FOUND')
  })

  test('sendProposal missing required fields returns 400', async ({ request }) => {
    await createUserAndLogin(request, 'brand', 'missing-fields')

    const res = await request.post(`${BASE}/api/deals/proposals`, {
      data: { match_id: 'fake' },
    })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  test('sendProposal with invalid pay_type returns 400', async ({ request }) => {
    await createUserAndLogin(request, 'brand', 'invalid-pay-type')

    const res = await request.post(`${BASE}/api/deals/proposals`, {
      data: {
        match_id: '00000000-0000-0000-0000-000000000000',
        title: 'Test',
        pay_amount: 1000,
        pay_type: 'invalid_type',
      },
    })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PAY_TYPE')
  })

  test('respond to non-existent proposal returns 404', async ({ request }) => {
    await createUserAndLogin(request, 'athlete', 'respond-no-proposal')

    const res = await request.post(
      `${BASE}/api/deals/proposals/00000000-0000-0000-0000-000000000000/respond`,
      { data: { action: 'accepted' } }
    )
    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROPOSAL_NOT_FOUND')
  })

  test('respond with invalid action returns 400', async ({ request }) => {
    await createUserAndLogin(request, 'athlete', 'invalid-action')

    const res = await request.post(
      `${BASE}/api/deals/proposals/fake-id/respond`,
      { data: { action: 'invalid' } }
    )
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_ACTION')
  })

  test('counter non-existent proposal returns 404', async ({ request }) => {
    await createUserAndLogin(request, 'athlete', 'counter-no-proposal')

    const res = await request.post(
      `${BASE}/api/deals/proposals/00000000-0000-0000-0000-000000000000/counter`,
      {
        data: { title: 'Counter', pay_amount: 2000, pay_type: 'flat_fee' },
      }
    )
    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROPOSAL_NOT_FOUND')
  })

  test('withdraw non-existent proposal returns 404', async ({ request }) => {
    await createUserAndLogin(request, 'brand', 'withdraw-no-proposal')

    const res = await request.delete(
      `${BASE}/api/deals/proposals/00000000-0000-0000-0000-000000000000`
    )
    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROPOSAL_NOT_FOUND')
  })

  test('getContract for proposal with no contract returns 404', async ({ request }) => {
    await createUserAndLogin(request, 'brand', 'contract-not-found')

    const res = await request.get(
      `${BASE}/api/deals/proposals/00000000-0000-0000-0000-000000000000/contract`
    )
    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('CONTRACT_NOT_FOUND')
  })
})
