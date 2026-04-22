import { test, expect } from '@playwright/test'

test.describe('Brand flows', () => {
  test('brand onboarding step 1 redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/onboarding/step/1')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('brand dashboard redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/dashboard')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('brand discover redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/discover')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('brand listings redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/listings')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('brand subscription redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/subscription')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('/dashboard redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth/)
  })
})
