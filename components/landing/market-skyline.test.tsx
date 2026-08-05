import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import MarketSkyline from './market-skyline'
import { MARKET_PROFILES } from '@/lib/landing/market-fixtures'

describe('MarketSkyline', () => {
  it('renders one bar per profile', () => {
    render(<MarketSkyline />)
    expect(screen.getAllByRole('listitem')).toHaveLength(MARKET_PROFILES.length)
  })

  it('expands the focused profile into a card with its mono stat line', async () => {
    render(<MarketSkyline />)
    // Rita Silva (profile 0) is focused by default, which renders her as a
    // non-button card rather than a button (focused bars aren't buttons —
    // see the invalid-nesting fix). Defocus onto another bar first so her
    // collapsed button exists, then click it to exercise the real
    // click-to-focus path.
    await userEvent.click(screen.getByRole('button', { name: /Joe Okafor/ }))
    await userEvent.click(screen.getByRole('button', { name: /Rita Silva/ }))
    expect(screen.getByText('TENNIS · U21 · 22 DEALS')).toBeInTheDocument()
  })

  it('filters the skyline by sport chips', async () => {
    render(<MarketSkyline />)
    await userEvent.click(screen.getByRole('button', { name: 'Tennis' }))
    const tennis = MARKET_PROFILES.filter((p) => p.sport === 'Tennis')
    expect(screen.getAllByRole('listitem')).toHaveLength(tennis.length)
  })

  it('filters teams as a kind, not a sport', async () => {
    render(<MarketSkyline />)
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    const teams = MARKET_PROFILES.filter((p) => p.kind === 'team')
    expect(screen.getAllByRole('listitem')).toHaveLength(teams.length)
  })

  it('reconciles focus onto a visible profile when the active filter excludes it', async () => {
    render(<MarketSkyline />)
    // Default focus is Rita Silva (Tennis), which the Teams filter excludes.
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    const teams = MARKET_PROFILES.filter((p) => p.kind === 'team')
    const firstTeam = teams[0]!
    const expectedLine =
      `${firstTeam.sport} · ${firstTeam.tier} · ${firstTeam.deals} DEALS`.toUpperCase()
    expect(screen.getByText(expectedLine)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View' })).toBeInTheDocument()
  })

  it('keeps the expanded card usable for low-deal profiles (min focus height)', async () => {
    render(<MarketSkyline />)
    await userEvent.click(screen.getByRole('button', { name: 'Athletics' }))
    await userEvent.click(screen.getByRole('button', { name: /Tom Forster/ }))
    const viewLink = screen.getByRole('link', { name: 'View' })
    expect(viewLink).toBeInTheDocument()
    const card = viewLink.parentElement
    expect(card).not.toBeNull()
    expect(parseInt(card!.style.height, 10)).toBeGreaterThanOrEqual(176)
  })
})
