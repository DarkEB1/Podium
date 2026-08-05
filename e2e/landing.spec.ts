import { test, expect } from '@playwright/test'

test.describe('landing page', () => {
  test('desktop: five panels, horizontal track, baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('landing-track')).toBeVisible()
    await expect(page.getByTestId('baseline')).toBeAttached()
    // Scroll to the end: the last panel's CTA becomes visible.
    await page.mouse.wheel(0, 10000)
    await expect(page.getByRole('link', { name: 'Build your profile' })).toBeVisible()
  })

  test('mobile: vertical stack, all content reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByTestId('landing-stack')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Get on the podium' })).toBeVisible()
  })

  test('reduced motion: vertical stack on desktop', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('landing-stack')).toBeVisible()
  })

  test('market variants switch on the query param', async ({ page }) => {
    await page.goto('/?market=rally')
    await expect(page.getByText('Vantage Gear')).toBeVisible()
    await page.goto('/?market=skyline')
    await expect(page.getByRole('group', { name: 'Filter profiles' })).toBeVisible()
  })
})
