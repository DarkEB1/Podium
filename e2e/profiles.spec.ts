import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Profiles API — happy path', () => {
  test('full athlete profile lifecycle: create → update → publish → public read', async ({
    request,
  }) => {
    const email = `e2e-profile-${Date.now()}@example.com`
    const password = 'TestPass1!'

    // 1. Sign up
    const signup = await request.post(`${BASE}/api/auth/signup`, {
      data: { email, password },
    })
    expect(signup.ok()).toBeTruthy()

    // 2. Log in — sets session cookie on the request context
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email, password },
    })
    expect(login.ok()).toBeTruthy()
    const loginBody = await login.json()
    expect(loginBody.user.role).toBeNull()

    // 3. Lock role as athlete
    const lockRole = await request.post(`${BASE}/api/auth/role`, {
      data: { role: 'athlete' },
    })
    expect(lockRole.ok()).toBeTruthy()
    const lockBody = await lockRole.json()
    expect(lockBody.role).toBe('athlete')

    // 4. Create athlete profile — should fail before role is locked
    // (role_locked_at is now set from step 3)
    const createProfile = await request.post(`${BASE}/api/profiles/me`, {
      data: {
        display_name: 'E2E Athlete',
        primary_sport: 'Tennis',
        home_city: 'London',
        home_country: 'GB',
      },
    })
    expect(createProfile.status()).toBe(201)
    const created = await createProfile.json()
    expect(created.display_name).toBe('E2E Athlete')
    expect(created.status).toBe('draft')
    expect(created.user_id).toBeDefined()
    const userId = created.user_id as string

    // 5. Creating again returns 409
    const createAgain = await request.post(`${BASE}/api/profiles/me`, {
      data: { display_name: 'Duplicate' },
    })
    expect(createAgain.status()).toBe(409)
    const dupBody = await createAgain.json()
    expect(dupBody.error.code).toBe('PROFILE_ALREADY_EXISTS')

    // 6. Read own profile
    const getProfile = await request.get(`${BASE}/api/profiles/me`)
    expect(getProfile.ok()).toBeTruthy()
    const own = await getProfile.json()
    expect(own.display_name).toBe('E2E Athlete')

    // 7. Update profile
    const patchProfile = await request.patch(`${BASE}/api/profiles/me`, {
      data: { display_name: 'E2E Athlete Updated', level: 'amateur' },
    })
    expect(patchProfile.ok()).toBeTruthy()
    const updated = await patchProfile.json()
    expect(updated.display_name).toBe('E2E Athlete Updated')

    // 8. Public profile is not yet visible (still draft)
    const notPublic = await request.get(`${BASE}/api/profiles/${userId}?role=athlete`)
    expect(notPublic.status()).toBe(404)

    // 9. Publish profile
    const publish = await request.post(`${BASE}/api/profiles/me/publish`)
    expect(publish.ok()).toBeTruthy()
    const publishBody = await publish.json()
    expect(publishBody.success).toBe(true)

    // 10. Public profile is now accessible
    const publicProfile = await request.get(`${BASE}/api/profiles/${userId}?role=athlete`)
    expect(publicProfile.ok()).toBeTruthy()
    const pub = await publicProfile.json()
    expect(pub.status).toBe('active')
    expect(pub.display_name).toBe('E2E Athlete Updated')
  })

  test('brand profile is immediately in pending_approval and cannot be published', async ({
    request,
  }) => {
    const email = `e2e-brand-${Date.now()}@example.com`
    const password = 'TestPass1!'

    await request.post(`${BASE}/api/auth/signup`, { data: { email, password } })
    await request.post(`${BASE}/api/auth/login`, { data: { email, password } })
    await request.post(`${BASE}/api/auth/role`, { data: { role: 'brand' } })

    const createProfile = await request.post(`${BASE}/api/profiles/me`, {
      data: {
        company_name: 'E2E Brand Co',
        linkedin_url: 'https://linkedin.com/company/e2e-brand',
      },
    })
    expect(createProfile.status()).toBe(201)
    const created = await createProfile.json()
    expect(created.status).toBe('pending_approval')

    // Publish is blocked for brands
    const publish = await request.post(`${BASE}/api/profiles/me/publish`)
    expect(publish.status()).toBe(400)
    const publishBody = await publish.json()
    expect(publishBody.error.code).toBe('BRAND_NOT_PUBLISHABLE')
  })
})
