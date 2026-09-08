import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type APIRequestContext,
} from '@playwright/test'

/**
 * Task 18 — contract e-signature, end to end: brand sends a proposal with
 * deliverables/usage-rights/additional-terms -> athlete accepts (contract
 * created `pending_brand_signature`) -> brand reviews the pinned terms and
 * signs -> athlete reviews and signs (`fully_signed`) -> both parties can
 * fetch the signed PDF, an unrelated account cannot.
 *
 * PRECONDITIONS TO RUN THIS SPEC (see task-18-report.md for the full story):
 *   1. Migrations 20260907000001-20260907000004 applied to whichever
 *      database the running app talks to (contract signer/PII columns, the
 *      esign provider tables, guardian RLS on the new columns).
 *   2. `supabase/seed.sql` applied against that same database, so the
 *      Northwind Nutrition <-> Maya Okafor match and the seed accounts exist
 *      (local login password for every seeded user is "podium-dev-password").
 *   3. `E2E_SEEDED_DB=1` set in the environment running Playwright, to opt in.
 * Without all three this whole file is skipped (see the test.skip below) —
 * that is a deliberate, honest skip, not a fake pass. `npm run e2e` /
 * `npm run test:e2e` runs it exactly like any other e2e/ spec; it is simply
 * inert until the seeded environment exists.
 *
 * WHY THIS SPEC USES THE SEEDED ACCOUNTS INSTEAD OF DISPOSABLE SIGNUPS (the
 * pattern every other e2e/ spec uses): sending a proposal needs a pre-existing
 * match, and creating a fresh match means sending a connection request, which
 * is gated behind an active brand subscription
 * (`assertCanSendConnectionRequest` in lib/supabase/entitlements.ts returns
 * `SUBSCRIPTION_REQUIRED` / 402 for a bare signup with no subscription). The
 * seeded Northwind/Maya match sidesteps that gate entirely, so this is the one
 * flow in e2e/ that needs supabase/seed.sql. Sending a SECOND, fresh proposal
 * on that already-consumed match is safe: `contracts.proposal_id` is unique,
 * so accepting it creates its own new contract row alongside the one
 * seed.sql pre-populates.
 *
 * Auth follows the same request-fixture login used by every other e2e/ spec
 * (POST /api/auth/login sets a session cookie on the request context); the
 * signing steps additionally drive the actual dialog UI with `page`, since
 * that is the only way to exercise the real "Review & Sign" flow (typed name
 * + consent checkbox) the brief calls for. `context.request` and `page` share
 * the same browser context, so a request-fixture login is visible to page
 * navigations in the same context (see https://playwright.dev/docs/api-testing).
 */

const BASE = 'http://localhost:3000'
const SEED_PASSWORD = 'podium-dev-password'
const BRAND_EMAIL = 'deals@northwind-nutrition.test'
const ATHLETE_EMAIL = 'maya.okafor@example.test'

const RUN_SEEDED_E2E = process.env.E2E_SEEDED_DB === '1'

test.describe.configure({ mode: 'serial' })

test.describe('Contract e-signature — accept → sign → finalize → download', () => {
  test.skip(
    !RUN_SEEDED_E2E,
    'Requires a DB with supabase/seed.sql applied and migrations 20260907000001-4 in place. ' +
      'Set E2E_SEEDED_DB=1 against such an environment (e.g. staging) to run this spec.'
  )

  let brandContext: BrowserContext
  let athleteContext: BrowserContext
  let brandPage: Page
  let athletePage: Page
  let brandRequest: APIRequestContext
  let athleteRequest: APIRequestContext

  let matchId: string
  let proposalId: string
  let contractId: string

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    brandContext = await browser.newContext({ baseURL: BASE })
    athleteContext = await browser.newContext({ baseURL: BASE })
    brandPage = await brandContext.newPage()
    athletePage = await athleteContext.newPage()
    brandRequest = brandContext.request
    athleteRequest = athleteContext.request

    const brandLogin = await brandRequest.post(`${BASE}/api/auth/login`, {
      data: { email: BRAND_EMAIL, password: SEED_PASSWORD },
    })
    expect(brandLogin.ok(), await brandLogin.text()).toBeTruthy()

    const athleteLogin = await athleteRequest.post(`${BASE}/api/auth/login`, {
      data: { email: ATHLETE_EMAIL, password: SEED_PASSWORD },
    })
    expect(athleteLogin.ok(), await athleteLogin.text()).toBeTruthy()

    // The seeded connection request between Northwind and Maya is the only
    // accepted one, so the brand has exactly one match to propose against.
    const matchesRes = await brandRequest.get(`${BASE}/api/messaging/matches`)
    expect(matchesRes.ok()).toBeTruthy()
    const matches = (await matchesRes.json()) as Array<{ id: string }>
    expect(matches.length).toBeGreaterThan(0)
    matchId = matches[0].id
  })

  test.afterAll(async () => {
    await brandContext?.close()
    await athleteContext?.close()
  })

  test('brand sends a proposal with deliverables, usage rights, and additional terms', async () => {
    const res = await brandRequest.post(`${BASE}/api/deals/proposals`, {
      data: {
        match_id: matchId,
        title: 'E2E autumn hydration campaign',
        pay_amount: 4200,
        pay_currency: 'GBP',
        pay_type: 'flat_fee',
        deliverables: { instagram_posts: 3, appearances: 1 },
        usage_rights: { territories: ['UK'], channels: ['social'], duration_months: 6 },
        additional_terms: 'E2E: exclusive within the hydration category for the contract term.',
      },
    })
    expect(res.status(), await res.text()).toBe(201)

    const proposal = (await res.json()) as { id: string; status: string }
    expect(proposal.status).toBe('pending')
    proposalId = proposal.id
  })

  test('athlete accepts the proposal, creating a contract pending brand signature', async () => {
    const respondRes = await athleteRequest.post(
      `${BASE}/api/deals/proposals/${proposalId}/respond`,
      { data: { action: 'accepted' } }
    )
    expect(respondRes.status(), await respondRes.text()).toBe(200)
    const proposal = (await respondRes.json()) as { status: string }
    expect(proposal.status).toBe('accepted')

    const contractRes = await athleteRequest.get(
      `${BASE}/api/deals/proposals/${proposalId}/contract`
    )
    expect(contractRes.ok(), await contractRes.text()).toBeTruthy()
    const contract = (await contractRes.json()) as { id: string; status: string }
    expect(contract.status).toBe('pending_brand_signature')
    contractId = contract.id
  })

  test('brand opens the deal, reads the pinned terms, and signs', async () => {
    await brandPage.goto(`/brand/deals/${proposalId}`)

    // "This is what you're signing" — the read-only terms block (Task 15/16)
    // must show the deliverables captured on the proposal above.
    await expect(
      brandPage.getByRole('heading', { name: /this is what you.re signing/i })
    ).toBeVisible()
    await expect(brandPage.getByText(/instagram_posts/)).toBeVisible()

    await brandPage.getByRole('button', { name: 'Review & Sign' }).click()
    await brandPage.getByLabel('Full name').fill('Northwind Nutrition Ltd')
    await brandPage.locator('#consent').check()
    await brandPage.getByRole('button', { name: 'Sign Contract' }).click()

    await expect(brandPage.getByText(/you have signed/i)).toBeVisible()

    const contractRes = await brandRequest.get(
      `${BASE}/api/deals/proposals/${proposalId}/contract`
    )
    const contract = (await contractRes.json()) as { status: string }
    expect(contract.status).toBe('pending_athlete_signature')
  })

  test('athlete opens the deal, reads the pinned terms, and signs — contract becomes fully signed', async () => {
    await athletePage.goto(`/athlete/deals/${proposalId}`)

    await expect(
      athletePage.getByRole('heading', { name: /this is what you.re signing/i })
    ).toBeVisible()
    await expect(athletePage.getByText(/instagram_posts/)).toBeVisible()

    await athletePage.getByRole('button', { name: 'Review & Sign' }).click()
    await athletePage.getByLabel('Full name').fill('Maya Okafor')
    await athletePage.locator('#consent').check()
    await athletePage.getByRole('button', { name: 'Sign Contract' }).click()

    // The last signature finalizes the document synchronously (Task 13/16),
    // so the download action appears without a further reload.
    await expect(athletePage.getByRole('link', { name: 'View / Download PDF' })).toBeVisible()

    const contractRes = await athleteRequest.get(
      `${BASE}/api/deals/proposals/${proposalId}/contract`
    )
    const contract = (await contractRes.json()) as { status: string }
    expect(contract.status).toBe('fully_signed')
  })

  test('the document route redirects a participant to a signed download URL', async () => {
    const res = await athleteRequest.get(
      `${BASE}/api/deals/contracts/${contractId}/document`,
      { maxRedirects: 0 }
    )
    expect(res.status()).toBe(302)
    expect(res.headers()['location']).toBeTruthy()
  })

  test('an unrelated third account cannot fetch the signed document', async ({ request }) => {
    // A fresh, disposable account (same pattern as every other e2e/ spec) —
    // never a match participant, so it must be refused either way.
    const email = `e2e-esign-outsider-${Date.now()}@example.com`
    const password = 'TestPass1!'
    await request.post(`${BASE}/api/auth/signup`, { data: { email, password } })
    await request.post(`${BASE}/api/auth/login`, { data: { email, password } })

    const res = await request.get(`${BASE}/api/deals/contracts/${contractId}/document`, {
      maxRedirects: 0,
    })
    expect([403, 404]).toContain(res.status())
  })
})
