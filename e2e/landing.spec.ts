import { test, expect, type Page } from '@playwright/test'

// Evidence for WS-LANDING-01 (responsive) and WS-LANDING-02 (keyboard). The
// landing renders two ways: the fixed horizontal corridor at md+ and a stacked
// vertical document below md. Both must lay out with no horizontal overflow and
// keep the primary journey reachable.

async function horizontalOverflowPx(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
}

test.describe('landing — desktop corridor (1440px)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('shows the corridor, no horizontal overflow, hero reachable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('stage-track')).toBeVisible()
    await expect(page.getByTestId('baseline')).toBeAttached()
    await expect(page.getByRole('link', { name: 'Get on the podium' })).toBeVisible()
    // The corridor is a clipped fixed stage; the page itself must not scroll
    // sideways (the 400vw track is clipped by design).
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: 'e2e/__screenshots__/landing-1440.png' })
  })

  test('Tab does not scroll the fixed corridor sideways (WS-LANDING-02)', async ({ page }) => {
    await page.goto('/')
    // The header leads the tab order and stays present after tabbing into the
    // panels; the stage box can no longer be scrolled sideways (overflow-clip).
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab')
    const scrollLeft = await page.getByTestId('stage').evaluate((el) => el.scrollLeft)
    expect(scrollLeft).toBe(0)
    await expect(page.getByRole('button', { name: 'Podium, back to start' })).toBeVisible()
  })
})

test.describe('landing — mobile stack (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('shows the stacked layout, no overflow, key content visible', async ({ page }) => {
    await page.goto('/')
    const stack = page.getByTestId('landing-stack')
    await expect(stack).toBeVisible()
    await expect(stack.getByRole('link', { name: 'Get on the podium' })).toBeVisible()
    await expect(stack.getByRole('heading', { name: /^Sponsorship/ })).toBeVisible()
    // The three story sections and the finale are all reachable in the flow.
    await expect(stack.getByRole('heading', { name: /Every profile is a/ })).toBeVisible()
    await expect(stack.getByRole('heading', { name: /Help you from profile to/ })).toBeVisible()
    await expect(stack.getByRole('heading', { name: /The podium has room for/ })).toBeVisible()
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: 'e2e/__screenshots__/landing-375.png', fullPage: true })
  })

  test('Pricing is reachable from the mobile menu', async ({ page }) => {
    await page.goto('/')
    // The corridor's nav links collapse into the disclosure menu below lg.
    await page.getByTestId('landing-stack').getByRole('button', { name: 'Open menu' }).click()
    const pricing = page.getByRole('menuitem', { name: 'Pricing' })
    await expect(pricing).toBeVisible()
    await pricing.click()
    await expect(page).toHaveURL(/\/pricing$/)
  })
})

test.describe('landing — 320px (smallest phone)', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('no horizontal overflow, headline not clipped', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-stack')).toBeVisible()
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
  })
})
