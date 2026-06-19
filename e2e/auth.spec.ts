import { test, expect } from '@playwright/test'

test.describe('Auth flows', () => {
  test('landing page renders hero CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /where athletes meet/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /list your profile/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /find talent/i })).toBeVisible()
  })

  test('sign-up page renders form', async ({ page }) => {
    await page.goto('/auth/signup')
    await expect(page.getByText(/create your account/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('login page renders form with forgot password link', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.getByText(/welcome back/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
  })

  test('weak password shows strength indicator', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByLabel(/password/i).fill('weak')
    await expect(page.getByText(/weak/i)).toBeVisible()
  })

  test('forgot password page shows anti-enumeration message on submit', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await page.getByLabel(/email/i).fill('any@example.com')
    await page.getByRole('button', { name: /send reset link/i }).click()
    await expect(page.getByText(/if this email exists/i)).toBeVisible()
  })

  test('403 page renders', async ({ page }) => {
    await page.goto('/403')
    await expect(page.getByRole('heading', { name: '403' })).toBeVisible()
  })

  test('role select redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/role-select')
    await expect(page).toHaveURL(/\/auth/)
  })
})
