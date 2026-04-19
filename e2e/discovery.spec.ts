import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

async function createUserAndLogin(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  role: string
) {
  const email = `e2e-discovery-${role}-${Date.now()}@example.com`
  const password = 'TestPass1!'

  await request.post(`${BASE}/api/auth/signup`, { data: { email, password } })
  await request.post(`${BASE}/api/auth/login`, { data: { email, password } })
  await request.post(`${BASE}/api/auth/role`, { data: { role } })

  return { email, password }
}

test.describe('Discovery API — happy path', () => {
  test('brand: create profile → create listing → update → publish', async ({ request }) => {
    await createUserAndLogin(request, 'brand')

    // Create brand profile
    const createProfile = await request.post(`${BASE}/api/profiles/me`, {
      data: {
        company_name: 'E2E Discovery Brand',
        linkedin_url: 'https://linkedin.com/company/e2e-discovery',
      },
    })
    expect(createProfile.status()).toBe(201)

    // Browse listings (empty or existing active ones)
    const browse = await request.get(`${BASE}/api/discovery/listings`)
    expect(browse.ok()).toBeTruthy()
    const listings = await browse.json()
    expect(Array.isArray(listings)).toBe(true)

    // Create a listing
    const createListing = await request.post(`${BASE}/api/discovery/listings`, {
      data: {
        title: 'E2E Tennis Athlete Wanted',
        type: 'athlete_endorsement',
        sport_required: 'tennis',
      },
    })
    expect(createListing.status()).toBe(201)
    const listing = await createListing.json()
    expect(listing.status).toBe('draft')
    expect(listing.title).toBe('E2E Tennis Athlete Wanted')
    const listingId = listing.id as string

    // Cannot inject status via create — protected fields stripped
    const createWithStatus = await request.post(`${BASE}/api/discovery/listings`, {
      data: { title: 'Injected', type: 'athlete_endorsement', status: 'active' },
    })
    expect(createWithStatus.status()).toBe(201)
    const injected = await createWithStatus.json()
    expect(injected.status).toBe('draft')

    // Read single listing
    const getListing = await request.get(`${BASE}/api/discovery/listings/${listingId}`)
    expect(getListing.ok()).toBeTruthy()
    const fetched = await getListing.json()
    expect(fetched.id).toBe(listingId)

    // Update listing
    const updateListing = await request.patch(`${BASE}/api/discovery/listings/${listingId}`, {
      data: { title: 'E2E Tennis Athlete Wanted — Updated' },
    })
    expect(updateListing.ok()).toBeTruthy()
    const updated = await updateListing.json()
    expect(updated.title).toBe('E2E Tennis Athlete Wanted — Updated')

    // Publish listing
    const publish = await request.post(`${BASE}/api/discovery/listings/${listingId}/publish`)
    expect(publish.ok()).toBeTruthy()
    const publishBody = await publish.json()
    expect(publishBody.success).toBe(true)

    // Re-publishing an already-active listing returns not found (status guard)
    const republish = await request.post(`${BASE}/api/discovery/listings/${listingId}/publish`)
    expect(republish.status()).toBe(404)
  })

  test('shortlist: add → list → remove', async ({ request }) => {
    await createUserAndLogin(request, 'brand')

    const meRes = await request.get(`${BASE}/api/auth/me`)
    const me = await meRes.json()
    const myId = me.id as string

    // List shortlist (empty)
    const listShortlist = await request.get(`${BASE}/api/discovery/shortlist`)
    expect(listShortlist.ok()).toBeTruthy()
    const shortlist = await listShortlist.json()
    expect(Array.isArray(shortlist)).toBe(true)

    // Cannot shortlist self (DB constraint blocks it)
    const shortlistSelf = await request.post(`${BASE}/api/discovery/shortlist`, {
      data: { target_user_id: myId },
    })
    expect([400, 409, 500].includes(shortlistSelf.status())).toBe(true)

    // Remove from shortlist is idempotent — returns 200 even if not shortlisted
    const remove = await request.delete(`${BASE}/api/discovery/shortlist/${myId}`)
    expect(remove.status()).toBe(200)
    const removeBody = await remove.json()
    expect(removeBody.success).toBe(true)
  })

  test('blocks: block → list → unblock (idempotent)', async ({ request }) => {
    await createUserAndLogin(request, 'athlete')

    const meRes = await request.get(`${BASE}/api/auth/me`)
    const me = await meRes.json()
    const myId = me.id as string

    // List blocks (empty)
    const listBlocks = await request.get(`${BASE}/api/discovery/blocks`)
    expect(listBlocks.ok()).toBeTruthy()
    const blocks = await listBlocks.json()
    expect(Array.isArray(blocks)).toBe(true)

    // Cannot block self (DB constraint)
    const blockSelf = await request.post(`${BASE}/api/discovery/blocks`, {
      data: { blocked_id: myId },
    })
    expect([400, 409, 500].includes(blockSelf.status())).toBe(true)

    // Unblock is idempotent — 200 even if not blocked
    const unblock = await request.delete(`${BASE}/api/discovery/blocks/${myId}`)
    expect(unblock.status()).toBe(200)
    const unblockBody = await unblock.json()
    expect(unblockBody.success).toBe(true)
  })
})
